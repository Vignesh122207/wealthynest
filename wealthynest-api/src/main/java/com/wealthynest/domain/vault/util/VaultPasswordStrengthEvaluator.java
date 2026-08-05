package com.wealthynest.domain.vault.util;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Server-side port of {@code wealthynest-web/src/features/vault/lib/passwordStrength.ts}'s
 * heuristic, kept in lockstep so the "weak" flag persisted for Vault Health always agrees with
 * what the create/edit form showed the user at save time. Levels: 0=Very weak .. 4=Very strong.
 */
public final class VaultPasswordStrengthEvaluator {
    private VaultPasswordStrengthEvaluator() {}

    private static final Pattern LOWER  = Pattern.compile("[a-z]");
    private static final Pattern UPPER  = Pattern.compile("[A-Z]");
    private static final Pattern DIGIT  = Pattern.compile("\\d");
    private static final Pattern SYMBOL = Pattern.compile("[^a-zA-Z0-9]");
    private static final Pattern NON_LETTER = Pattern.compile("[^a-z]");

    private static final List<String> COMMON_BASE_WORDS = List.of(
            "password", "letmein", "qwerty", "admin", "welcome", "monkey", "dragon", "master", "login",
            "abc", "iloveyou", "sunshine", "princess", "football", "baseball", "superman", "trustno",
            "starwars", "whatever", "freedom", "batman", "hello", "charlie", "donald", "michael");

    /** A 4- or 6-digit numeric secret is a bank/device PIN (ATM PIN, MPIN), not a password — it's
     * drawn from a 10,000/1,000,000-value space by design, so scoring it on length/character-class
     * variety flags every single PIN as "very weak" regardless of which one was picked. Weakness for
     * a PIN is about being *guessable* (repeated/sequential/common), not short. */
    private static final Pattern NUMERIC_PIN = Pattern.compile("^\\d{4}$|^\\d{6}$");

    /** The most-guessed 4-digit PINs from published PIN-frequency breach analyses, plus their
     * 6-digit analogues — these are the ones an attacker tries first regardless of entropy. */
    private static final Set<String> COMMON_PINS = Set.of(
            "1234", "1111", "0000", "1212", "7777", "1004", "2000", "4444", "2222", "6969",
            "9999", "3333", "5555", "6666", "1122", "1313", "8888", "4321", "2001", "1010",
            "123456", "111111", "000000", "123123", "654321", "121212", "112233");

    public static int evaluate(String password) {
        if (password == null || password.isEmpty()) return 0;
        if (NUMERIC_PIN.matcher(password).matches()) return evaluatePin(password);

        int score = 0;
        if (password.length() >= 8)  score++;
        if (password.length() >= 12) score++;
        if (password.length() >= 16) score++;
        if (LOWER.matcher(password).find() && UPPER.matcher(password).find()) score++;
        if (DIGIT.matcher(password).find()) score++;
        if (SYMBOL.matcher(password).find()) score++;

        int level = Math.min(4, (int) Math.floor(score / 1.5));

        String lettersOnly = NON_LETTER.matcher(password.toLowerCase()).replaceAll("");
        if (COMMON_BASE_WORDS.stream().anyMatch(lettersOnly::contains)) {
            level = Math.min(level, 1);
        }
        return level;
    }

    /** True for a 4- or 6-digit numeric PIN (ATM PIN/MPIN) — the shape {@link #evaluate} and the
     * caller's breach check both need to branch on, since a PIN's small fixed value-space makes
     * generic password strength/breach scoring meaningless. */
    public static boolean isNumericPin(String secret) {
        return secret != null && NUMERIC_PIN.matcher(secret).matches();
    }

    private static int evaluatePin(String pin) {
        if (COMMON_PINS.contains(pin)) return 0;
        if (isRepeatedDigit(pin) || isSequential(pin) || isRepeatingBlock(pin)) return 0;
        return 3;
    }

    private static boolean isRepeatedDigit(String pin) {
        char first = pin.charAt(0);
        return pin.chars().allMatch(c -> c == first);
    }

    private static boolean isSequential(String pin) {
        boolean ascending = true, descending = true;
        for (int i = 1; i < pin.length(); i++) {
            int prev = pin.charAt(i - 1) - '0';
            int cur  = pin.charAt(i) - '0';
            if (cur != prev + 1) ascending = false;
            if (cur != prev - 1) descending = false;
        }
        return ascending || descending;
    }

    /** Catches PINs built from a repeated shorter block — e.g. "121212" (block "12" x3) or
     * "123123" (block "123" x2) — which are far more guessable than their digit variety suggests. */
    private static boolean isRepeatingBlock(String pin) {
        int len = pin.length();
        for (int blockSize = 1; blockSize <= len / 2; blockSize++) {
            if (len % blockSize != 0) continue;
            String block = pin.substring(0, blockSize);
            if (block.repeat(len / blockSize).equals(pin)) return true;
        }
        return false;
    }
}
