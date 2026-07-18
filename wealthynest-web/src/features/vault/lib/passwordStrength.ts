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

/** A lightweight local heuristic (length + character-class variety + a common-word check), not a
 * real entropy/dictionary estimator like zxcvbn — good enough to nudge users away from short
 * single-class passwords and common breach-list bases without shipping a large wordlist dependency. */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { level: 0, label: LABELS[0], color: COLORS[0] };

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
