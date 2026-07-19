package com.wealthynest.common.security;

import com.wealthynest.config.VaultProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VaultSecretHasherTest {

    private VaultSecretHasher hasher;

    @BeforeEach
    void setUp() {
        VaultProperties props = new VaultProperties();
        props.setHashPepper("test-pepper-not-for-production");
        hasher = new VaultSecretHasher(props);
    }

    @Test
    @DisplayName("same plaintext hashed twice -> identical, deterministic hash")
    void deterministic_sameInputSameHash() {
        assertThat(hasher.hash("hunter2")).isEqualTo(hasher.hash("hunter2"));
    }

    @Test
    @DisplayName("different plaintext -> different hash")
    void differentInputs_differentHashes() {
        assertThat(hasher.hash("hunter2")).isNotEqualTo(hasher.hash("hunter3"));
    }

    @Test
    @DisplayName("hash output is 64 lowercase hex characters (SHA-256 digest length)")
    void outputIsHexEncodedSha256Length() {
        String hash = hasher.hash("some-secret");
        assertThat(hash).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    @DisplayName("a different pepper produces a different hash for the same plaintext")
    void differentPepper_differentHash() {
        VaultProperties otherProps = new VaultProperties();
        otherProps.setHashPepper("a-completely-different-pepper");
        VaultSecretHasher otherHasher = new VaultSecretHasher(otherProps);

        assertThat(hasher.hash("hunter2")).isNotEqualTo(otherHasher.hash("hunter2"));
    }
}
