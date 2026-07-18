package com.wealthynest.common.security;

import com.wealthynest.config.VaultProperties;
import lombok.RequiredArgsConstructor;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import org.springframework.stereotype.Service;

/**
 * Field-level AES-256-GCM encryption for vault secrets. A fresh random IV is
 * generated per call, so encrypting the same plaintext twice never produces
 * the same ciphertext — required for GCM's security guarantees, and also
 * means ciphertext can't be used to detect duplicate passwords across items.
 * The GCM auth tag is appended to the ciphertext by the JDK implementation,
 * so no separate tag column/field is needed.
 */
@Service
@RequiredArgsConstructor
public class VaultEncryptionService {
    private static final String ALGORITHM       = "AES/GCM/NoPadding";
    private static final int    IV_LENGTH_BYTES = 12;
    private static final int    TAG_LENGTH_BITS = 128;

    private final VaultProperties vaultProperties;
    private final SecureRandom    secureRandom = new SecureRandom();

    public record EncryptedSecret(String ciphertext, String iv) {}

    public EncryptedSecret encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            return new EncryptedSecret(
                    Base64.getEncoder().encodeToString(ciphertext),
                    Base64.getEncoder().encodeToString(iv));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt vault secret", e);
        }
    }

    public String decrypt(String ciphertextB64, String ivB64) {
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            byte[] iv = Base64.getDecoder().decode(ivB64);
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] plaintext = cipher.doFinal(Base64.getDecoder().decode(ciphertextB64));
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to decrypt vault secret — data may be corrupted or tampered with", e);
        }
    }

    private SecretKeySpec secretKey() {
        return new SecretKeySpec(Base64.getDecoder().decode(vaultProperties.getEncryptionKey()), "AES");
    }
}
