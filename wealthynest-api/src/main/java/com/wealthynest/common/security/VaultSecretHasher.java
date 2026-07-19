package com.wealthynest.common.security;

import com.wealthynest.config.VaultProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;

/**
 * Keyed HMAC-SHA256 of a vault secret's plaintext, used only for reused-password detection
 * (Vault Health) — a {@code GROUP BY} on this hash finds items sharing a password without ever
 * decrypting or comparing plaintext outside the write path. Keyed with {@code hashPepper}, a
 * secret distinct from {@link VaultEncryptionService}'s AES key, so the two never overlap.
 */
@Service
@RequiredArgsConstructor
public class VaultSecretHasher {
    private static final String ALGORITHM = "HmacSHA256";

    private final VaultProperties vaultProperties;

    public String hash(String plaintext) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(
                    vaultProperties.getHashPepper().getBytes(StandardCharsets.UTF_8), ALGORITHM));
            byte[] digest = mac.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to hash vault secret", e);
        }
    }
}
