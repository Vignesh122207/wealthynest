package com.wealthynest.domain.vault.dto.request;

import lombok.Getter;

/** Either field authenticates a step-up action (reveal/export): {@code currentPassword} does the
 * normal password re-confirmation; {@code stepUpToken} is the short-lived trust token issued by a
 * prior successful reveal (opt-in "trust this device" — see VaultServiceImpl#issueStepUpToken).
 * Exactly one is expected; the service rejects the request if neither is usable. */
@Getter
public class RevealVaultItemRequest {
    private String currentPassword;
    private String stepUpToken;
}
