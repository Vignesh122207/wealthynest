package com.wealthynest.domain.vault.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.UUID;

/** Returned only from the reveal endpoint, after step-up password confirmation. */
@Getter @Builder
public class VaultItemSecretResponse {
    private UUID id;
    private String secret;
    /** Decrypted base32 TOTP secret, present only when the item has one — the client generates
     * rotating codes locally from this rather than the server issuing codes itself. */
    private String totpSecret;
    /** Short-lived opaque token the client may cache (in memory only, opt-in "trust this device")
     * to skip re-entering the password on the next reveal/export within its TTL. */
    private String stepUpToken;
}
