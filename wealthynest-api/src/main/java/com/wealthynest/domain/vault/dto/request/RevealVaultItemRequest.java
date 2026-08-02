package com.wealthynest.domain.vault.dto.request;

import lombok.Getter;
import java.util.Map;

/** Exactly one field authenticates a step-up action (reveal/export): {@code currentPassword} does
 * the normal password re-confirmation; {@code pin} does the same against the account's PIN, for
 * accounts that have one enabled (see VaultServiceImpl#requireStepUpPin — a lighter alternative
 * to retyping the full password, not a weaker one: it's checked with the same lockout counter);
 * {@code passkeyCredential} is a WebAuthn assertion against a passkey already registered on the
 * account (see VaultServiceImpl#requireStepUpPasskey) — unlike a bare native-biometric check, this
 * is real cryptographic proof the server can verify, so it sits alongside password/PIN rather than
 * being excluded the way local-only biometric still is; {@code stepUpToken} is the short-lived
 * trust token issued by a prior successful reveal (opt-in "trust this device" — see
 * VaultServiceImpl#issueStepUpToken). The service rejects the request if none is usable. */
@Getter
public class RevealVaultItemRequest {
    private String currentPassword;
    private String pin;
    private Map<String, Object> passkeyCredential;
    private String stepUpToken;
}
