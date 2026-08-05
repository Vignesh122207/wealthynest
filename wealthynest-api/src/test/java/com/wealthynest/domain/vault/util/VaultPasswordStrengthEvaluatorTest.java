package com.wealthynest.domain.vault.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class VaultPasswordStrengthEvaluatorTest {

    @ParameterizedTest
    @ValueSource(strings = {"1234", "654321", "0000", "998877"})
    void isNumericPinTrueFor4And6DigitSecrets(String pin) {
        assertThat(VaultPasswordStrengthEvaluator.isNumericPin(pin)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"12345", "abcd", "12ab", "1234567", ""})
    void isNumericPinFalseForNonPinShapes(String secret) {
        assertThat(VaultPasswordStrengthEvaluator.isNumericPin(secret)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"1234", "1111", "0000", "4321", "123456", "654321", "111111", "121212", "123123", "1004", "6969"})
    void flagsCommonSequentialRepeatedAndBlockPinsAsVeryWeak(String pin) {
        assertThat(VaultPasswordStrengthEvaluator.evaluate(pin)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"7392", "5081", "482913"})
    void nonGuessablePinsAreNotFlaggedWeakJustForBeingShort(String pin) {
        assertThat(VaultPasswordStrengthEvaluator.evaluate(pin)).isGreaterThan(1);
    }

    @Test
    void alphanumericPasswordsStillUseTheGenericHeuristic() {
        assertThat(VaultPasswordStrengthEvaluator.evaluate("abc")).isZero();
        assertThat(VaultPasswordStrengthEvaluator.evaluate("Tr0ub4dor&3Xyz!")).isGreaterThan(2);
    }
}
