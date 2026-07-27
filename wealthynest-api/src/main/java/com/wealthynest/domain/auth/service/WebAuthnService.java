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
}
