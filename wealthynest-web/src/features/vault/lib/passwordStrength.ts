export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  color: string;
}

const LABELS: PasswordStrength["label"][] = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
const COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#30D158", "#34C759"];

/** Top breach-list passwords/words — appending digits or a symbol (e.g. "Password123!") doesn't
 * make these meaningfully harder to guess, since crackers try exactly that pattern first. Checked
 * against the password's letters-only lowercase form so casing/suffixes don't dodge the match. */
const COMMON_BASE_WORDS = [
  "password","letmein","qwerty","admin","welcome","monkey","dragon","master","login",
  "abc","iloveyou","sunshine","princess","football","baseball","superman","trustno",
  "starwars","whatever","freedom","batman","hello","charlie","donald","michael",
];

/** A 4- or 6-digit numeric secret is a bank/device PIN (ATM PIN, MPIN), not a password — see
 * {@link isNumericPin}'s server-side twin ({@code VaultPasswordStrengthEvaluator.isNumericPin})
 * for why scoring it on length/character-class variety flags every possible PIN as "very weak". */
const NUMERIC_PIN = /^\d{4}$|^\d{6}$/;

/** Most-guessed 4-digit PINs from published PIN-frequency breach analyses, plus 6-digit analogues
 * — kept identical to the backend's {@code COMMON_PINS} so the form's live meter always agrees
 * with what Vault Health persists. */
const COMMON_PINS = new Set([
  "1234", "1111", "0000", "1212", "7777", "1004", "2000", "4444", "2222", "6969",
  "9999", "3333", "5555", "6666", "1122", "1313", "8888", "4321", "2001", "1010",
  "123456", "111111", "000000", "123123", "654321", "121212", "112233",
]);

export function isNumericPin(secret: string): boolean {
  return NUMERIC_PIN.test(secret);
}

function isRepeatedDigit(pin: string): boolean {
  return pin.split("").every((c) => c === pin[0]);
}

function isSequential(pin: string): boolean {
  let ascending = true, descending = true;
  for (let i = 1; i < pin.length; i++) {
    const prev = pin.charCodeAt(i - 1) - 48;
    const cur  = pin.charCodeAt(i) - 48;
    if (cur !== prev + 1) ascending = false;
    if (cur !== prev - 1) descending = false;
  }
  return ascending || descending;
}

/** Catches PINs built from a repeated shorter block — e.g. "121212" (block "12" x3) or "123123"
 * (block "123" x2) — which are far more guessable than their digit variety suggests. */
function isRepeatingBlock(pin: string): boolean {
  for (let blockSize = 1; blockSize <= pin.length / 2; blockSize++) {
    if (pin.length % blockSize !== 0) continue;
    const block = pin.slice(0, blockSize);
    if (block.repeat(pin.length / blockSize) === pin) return true;
  }
  return false;
}

/** A PIN's weakness is about being *guessable* (repeated/sequential/common), not short — it's
 * drawn from a fixed 10,000/1,000,000-value space by design, so the generic length/variety
 * heuristic below would flag every single PIN as "very weak" regardless of which one was picked. */
function evaluatePinStrength(pin: string): PasswordStrengthLevel {
  if (COMMON_PINS.has(pin) || isRepeatedDigit(pin) || isSequential(pin) || isRepeatingBlock(pin)) {
    return 0;
  }
  return 3;
}

/** A lightweight local heuristic (length + character-class variety + a common-word check), not a
 * real entropy/dictionary estimator like zxcvbn — good enough to nudge users away from short
 * single-class passwords and common breach-list bases without shipping a large wordlist dependency. */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: LABELS[0], color: COLORS[0] };

  if (isNumericPin(password)) {
    const level = evaluatePinStrength(password);
    return { level, label: LABELS[level], color: COLORS[level] };
  }

  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  let level = Math.min(4, Math.floor(score / 1.5)) as PasswordStrengthLevel;

  const lettersOnly = password.toLowerCase().replace(/[^a-z]/g, "");
  if (COMMON_BASE_WORDS.some((w) => lettersOnly.includes(w))) {
    level = Math.min(level, 1) as PasswordStrengthLevel;
  }

  return { level, label: LABELS[level], color: COLORS[level] };
}
