package com.wealthynest.domain.vault.util;

import java.util.List;
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

    public static int evaluate(String password) {
        if (password == null || password.isEmpty()) return 0;

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
}
