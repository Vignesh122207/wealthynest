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
    AuthResponse verifyAuthentication(String email, Map<String, Object> credential, boolean rememberMe,
                                       String ipAddress, String userAgent);
}
