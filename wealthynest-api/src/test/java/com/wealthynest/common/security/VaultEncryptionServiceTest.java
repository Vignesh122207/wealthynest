package com.wealthynest.common.security;

import com.wealthynest.config.VaultProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VaultEncryptionServiceTest {

    private VaultEncryptionService encryptionService;

    @BeforeEach
    void setUp() {
        VaultProperties props = new VaultProperties();
        props.setEncryptionKey(Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".substring(0, 32).getBytes()));
        encryptionService = new VaultEncryptionService(props);
    }

    @Test
    void roundTripsPlaintextThroughEncryptAndDecrypt() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("hunter2-super-secret");
        String decrypted = encryptionService.decrypt(encrypted.ciphertext(), encrypted.iv());
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
            assertThat(encryptionService.decrypt(encrypted.ciphertext(), encrypted.iv())).isEqualTo(plaintext);
        }
    }

    @Test
    void decryptFailsWhenCiphertextIsTampered() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("original-value");
        byte[] tampered = Base64.getDecoder().decode(encrypted.ciphertext());
        tampered[0] ^= 0xFF;
        String tamperedB64 = Base64.getEncoder().encodeToString(tampered);

        assertThatThrownBy(() -> encryptionService.decrypt(tamperedB64, encrypted.iv()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void decryptFailsWithWrongKey() {
        VaultEncryptionService.EncryptedSecret encrypted = encryptionService.encrypt("original-value");

        VaultProperties otherProps = new VaultProperties();
        otherProps.setEncryptionKey(Base64.getEncoder().encodeToString("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz".getBytes()));
        VaultEncryptionService otherService = new VaultEncryptionService(otherProps);

        assertThatThrownBy(() -> otherService.decrypt(encrypted.ciphertext(), encrypted.iv()))
                .isInstanceOf(IllegalStateException.class);
    }
}
