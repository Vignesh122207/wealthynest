package com.wealthynest.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@ConfigurationProperties(prefix = "wealthynest.security.vault")
public class VaultProperties {
    private String encryptionKey;

    /** Which key version {@link #encryptionKey} corresponds to, and the version every newly
     * (re-)encrypted vault field is written under. Defaults to 1, matching vault_items.key_version's
     * DB default — bump this and move the old value into previousEncryptionKeys to rotate. */
    private int currentKeyVersion = 1;

    /** Retired keys, keyed by their version number, kept only so rows not yet re-encrypted under
     * {@link #currentKeyVersion} can still be decrypted. Empty until the first rotation ever happens. */
    private Map<Integer, String> previousEncryptionKeys = new HashMap<>();

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
        validateKeyFormat("VAULT_ENCRYPTION_KEY", encryptionKey);
        for (Map.Entry<Integer, String> entry : previousEncryptionKeys.entrySet()) {
            validateKeyFormat("VAULT_ENCRYPTION_KEY (previous, version " + entry.getKey() + ")", entry.getValue());
        }
        if (previousEncryptionKeys.containsKey(currentKeyVersion)) {
            throw new IllegalStateException(
                    "FATAL: previousEncryptionKeys contains an entry for currentKeyVersion (" + currentKeyVersion +
                            ") — that version's key must only be set via encryptionKey.");
        }

        if (hashPepper == null || hashPepper.isBlank()
                || "change-this-pepper-in-production".equals(hashPepper)) {
            throw new IllegalStateException(
                    "FATAL: VAULT_HASH_PEPPER is not configured or is using the insecure default value. " +
                            "Set the VAULT_HASH_PEPPER environment variable to a random secret " +
                            "(generate with: openssl rand -base64 32).");
        }
    }

    private static void validateKeyFormat(String label, String keyB64) {
        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(keyB64);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("FATAL: " + label + " must be valid base64.");
        }
        if (decoded.length != 32) {
            throw new IllegalStateException(
                    "FATAL: " + label + " must decode to exactly 32 bytes for AES-256, got " + decoded.length + ".");
        }
    }
}
