package com.wealthynest.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Base64;

@Getter
@Setter
@ConfigurationProperties(prefix = "wealthynest.security.vault")
public class VaultProperties {
    private String encryptionKey;

    /** Keys the HMAC-SHA256 used for reused-password detection (Vault Health). Deliberately a
     * separate secret from encryptionKey — it's used to derive a non-reversible-in-practice hash
     * that's compared across items, a different exposure profile than the AES key. */
    private String hashPepper;

    @PostConstruct
    public void validate() {
        if (encryptionKey == null
                || "change-this-key-in-production-must-be-32-byte-base64".equals(encryptionKey)) {
            throw new IllegalStateException(
                    "FATAL: VAULT_ENCRYPTION_KEY is not configured or is using the insecure default value. " +
                            "Set the VAULT_ENCRYPTION_KEY environment variable to a base64-encoded 32-byte key " +
                            "(generate with: openssl rand -base64 32).");
        }
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(encryptionKey);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("FATAL: VAULT_ENCRYPTION_KEY must be valid base64.");
        }
        if (decoded.length != 32) {
            throw new IllegalStateException(
                    "FATAL: VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256, got " + decoded.length + ".");
        }

        if (hashPepper == null || hashPepper.isBlank()
                || "change-this-pepper-in-production".equals(hashPepper)) {
            throw new IllegalStateException(
                    "FATAL: VAULT_HASH_PEPPER is not configured or is using the insecure default value. " +
                            "Set the VAULT_HASH_PEPPER environment variable to a random secret " +
                            "(generate with: openssl rand -base64 32).");
        }
    }
}
