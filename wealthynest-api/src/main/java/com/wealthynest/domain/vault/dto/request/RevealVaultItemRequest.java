package com.wealthynest.domain.vault.dto.request;

import lombok.Getter;

/** Exactly one field authenticates a step-up action (reveal/export): {@code currentPassword} does
 * the normal password re-confirmation; {@code pin} does the same against the account's PIN, for
 * accounts that have one enabled (see VaultServiceImpl#requireStepUpPin — a lighter alternative
 * to retyping the full password, not a weaker one: it's checked with the same lockout counter);
 * {@code stepUpToken} is the short-lived trust token issued by a prior successful reveal (opt-in
 * "trust this device" — see VaultServiceImpl#issueStepUpToken). The service rejects the request
 * if none is usable. */
@Getter
public class RevealVaultItemRequest {
    private String currentPassword;
    private String pin;
    private String stepUpToken;
}
