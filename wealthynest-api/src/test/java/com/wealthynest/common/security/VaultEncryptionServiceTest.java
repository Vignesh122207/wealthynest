package com.wealthynest.common.security;

import com.wealthynest.config.VaultProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VaultEncryptionServiceTest {

    private VaultEncryptionService encryptionService;

    private static String randomKey() {
        byte[] key = new byte[32];
        new java.security.SecureRandom().nextBytes(key);
        return Base64.getEncoder().encodeToString(key);
    }

    @BeforeEach
    void setUp() {
        VaultProperties props = new VaultProperties();
        props.setEncryptionKey(randomKey());
        encryptionService = new VaultEncryptionService(props);
    }

    @Test
    void roundTripsPlaintextThroughEncryptAndDecrypt() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("hunter2-super-secret");
        String decrypted = encryptionService.decrypt(encrypted.ciphertext(), encrypted.iv(), encrypted.keyVersion());
        assertThat(decrypted).isEqualTo("hunter2-super-secret");
    }

    @Test
    void producesDifferentCiphertextForTheSamePlaintextOnEachCall() {
        VaultEncryptionService.EncryptedSecret first  = encryptionService.encrypt("same-password");
        VaultEncryptionService.EncryptedSecret second = encryptionService.encrypt("same-password");

        assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        assertThat(first.iv()).isNotEqualTo(second.iv());
    }

    @Test
    void roundTripsEmptyAndUnicodePlaintext() {
        for (String plaintext : new String[] {"", "पासवर्ड123!@#", "🔒secure🔑"}) {
            VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt(plaintext);
            assertThat(encryptionService.decrypt(encrypted.ciphertext(), encrypted.iv(), encrypted.keyVersion())).isEqualTo(plaintext);
        }
    }

    @Test
    void decryptFailsWhenCiphertextIsTampered() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("original-value");
        byte[] tampered = Base64.getDecoder().decode(encrypted.ciphertext());
        tampered[0] ^= 0xFF;
        String tamperedB64 = Base64.getEncoder().encodeToString(tampered);

        assertThatThrownBy(() -> encryptionService.decrypt(tamperedB64, encrypted.iv(), encrypted.keyVersion()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void decryptFailsWithWrongKey() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("original-value");

        VaultProperties otherProps = new VaultProperties();
        otherProps.setEncryptionKey(randomKey());
        VaultEncryptionService otherService = new VaultEncryptionService(otherProps);

        assertThatThrownBy(() -> otherService.decrypt(encrypted.ciphertext(), encrypted.iv(), encrypted.keyVersion()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Nested
    @DisplayName("key versioning / rotation")
    class KeyVersioningTests {

        @Test
        @DisplayName("encrypt() tags new ciphertext with the configured currentKeyVersion")
        void encryptTagsCurrentVersion() {
            VaultProperties props = new VaultProperties();
            props.setEncryptionKey(randomKey());
            props.setCurrentKeyVersion(3);
            VaultEncryptionService service = new VaultEncryptionService(props);

            VaultEncryptionService.EncryptedSecret encrypted = service.encrypt("value");

            assertThat(encrypted.keyVersion()).isEqualTo(3);
            assertThat(service.currentKeyVersion()).isEqualTo(3);
        }

        @Test
        @DisplayName("decrypt() can still read a ciphertext encrypted under a retired (previous) key version after rotation")
        void decryptsUnderRetiredKeyAfterRotation() {
            VaultProperties props = new VaultProperties();
            String oldKey = randomKey();
            props.setEncryptionKey(oldKey);
            props.setCurrentKeyVersion(1);
            VaultEncryptionService v1Service = new VaultEncryptionService(props);
            VaultEncryptionService.EncryptedSecret encryptedUnderV1 = v1Service.encrypt("pre-rotation-secret");

            // Simulate a rotation: version 2 becomes current, version 1's key moves to "previous".
            VaultProperties rotatedProps = new VaultProperties();
            rotatedProps.setEncryptionKey(randomKey());
            rotatedProps.setCurrentKeyVersion(2);
            rotatedProps.setPreviousEncryptionKeys(Map.of(1, oldKey));
            VaultEncryptionService rotatedService = new VaultEncryptionService(rotatedProps);

            String decrypted = rotatedService.decrypt(
                    encryptedUnderV1.ciphertext(), encryptedUnderV1.iv(), 1);

            assertThat(decrypted).isEqualTo("pre-rotation-secret");
            // New writes go out under the new current version, not the retired one.
            assertThat(rotatedService.encrypt("new-secret").keyVersion()).isEqualTo(2);
        }

        @Test
        @DisplayName("decrypt() throws a clear error for a key version with no configured key at all")
        void throwsForUnknownKeyVersion() {
            VaultProperties props = new VaultProperties();
            props.setEncryptionKey(randomKey());
            VaultEncryptionService service = new VaultEncryptionService(props);
            VaultEncryptionService.EncryptedSecret encrypted = service.encrypt("value");

            assertThatThrownBy(() -> service.decrypt(encrypted.ciphertext(), encrypted.iv(), 99))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("key version 99");
        }
    }
}
