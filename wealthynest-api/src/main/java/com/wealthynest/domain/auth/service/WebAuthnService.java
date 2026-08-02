package com.wealthynest.domain.auth.service;

import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.dto.response.PasskeyResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface WebAuthnService {
    Map<String, Object> getRegistrationOptions(UUID userId);
    void verifyRegistration(UUID userId, Map<String, Object> credential, String nickname);
    List<PasskeyResponse> listPasskeys(UUID userId);
    void deletePasskey(UUID userId, UUID passkeyId);
    Map<String, Object> getAuthenticationOptions(String email);
    /** {@code previousRefreshToken} — whatever refresh token the caller's device already had
     * locally, if any — is forwarded to AuthService#issueTokensForVerifiedUser so that row can be
     * revoked instead of left to accumulate as a duplicate active session. See that method's own
     * comment for the full why. */
    AuthResponse verifyAuthentication(String email, Map<String, Object> credential, boolean rememberMe,
                                       String previousRefreshToken, String ipAddress, String userAgent);

    /** Challenge for an already-authenticated caller to re-prove themselves with a passkey they
     * already registered — used as a Vault reveal/export step-up credential (see
     * VaultServiceImpl#requireStepUpPasskey), unlike registration/login which both establish a
     * credential or a session from scratch. Throws if the account has no registered passkey. */
    Map<String, Object> getStepUpOptions(UUID userId);

    /** Verifies {@code credential} against {@code userId}'s own registered passkey(s) and the
     * challenge issued by {@link #getStepUpOptions}. Throws on an expired/missing challenge, an
     * unrecognized credential, a credential owned by a different account, or a failed
     * cryptographic verification — never returns a boolean, since every failure mode here should
     * also flow through the caller's own step-up lockout/audit handling. */
    void verifyStepUp(UUID userId, Map<String, Object> credential);
}
