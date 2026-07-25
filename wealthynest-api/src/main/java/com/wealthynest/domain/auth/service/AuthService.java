package com.wealthynest.domain.auth.service;

import com.wealthynest.domain.auth.dto.request.*;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.dto.response.SessionResponse;

import java.util.List;
import java.util.UUID;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request, String ipAddress, String userAgent);
    AuthResponse refresh(String refreshToken, String ipAddress, String userAgent);
    void logout(String refreshToken, String ipAddress, String userAgent);
    void forgotPassword(ForgotPasswordRequest request);
    void resetPassword(ResetPasswordRequest request, String ipAddress, String userAgent);
    void verifyEmail(String token, String ipAddress, String userAgent);
    void resendVerification(String email);
    /** Starts an email change — verifies the current password, stores the requested address as
     * User.pendingEmail, and sends a verification link there. The current email stays active and
     * verified until that link is clicked (see verifyEmail's pendingEmail branch). */
    void changeEmail(UUID userId, ChangeEmailRequest request, String ipAddress, String userAgent);
    void enablePin(UUID userId, EnablePinRequest request);
    void disablePin(UUID userId);
    AuthResponse pinLogin(PinLoginRequest request, String refreshToken, String ipAddress, String userAgent);
    AuthResponse googleLogin(GoogleLoginRequest request, String ipAddress, String userAgent);
    /** Native Android counterpart to googleLogin — exchanges an authorization code (not an ID
     * token) for one server-side, since the client secret that exchange requires can't safely
     * live in the app. See GoogleNativeLoginRequest's own comment for the full why. */
    AuthResponse googleLoginNative(GoogleNativeLoginRequest request, String ipAddress, String userAgent);
    /** Issues tokens for a user already authenticated by another factor (passkey) — the same
     * token-issuing core password/PIN login use, exposed for WebAuthnServiceImpl to reuse.
     * {@code previousRefreshToken} is whatever refresh token this device already had locally, if
     * any — unlike PIN (whose refreshToken input is exactly what login()/refresh() already rotate),
     * a passkey ceremony carries no token of its own to rotate, so without this the device's prior
     * session row would never get revoked and each passkey login/unlock would leave it sitting
     * active, showing up as a duplicate entry in the sessions list. Null/blank/unknown/foreign is
     * fine — silently no-ops rather than failing the login over a best-effort cleanup. */
    AuthResponse issueTokensForVerifiedUser(UUID userId, boolean rememberMe, String ipAddress, String userAgent, String previousRefreshToken);

    /** Every active (non-revoked, non-expired) refresh token row for this user — one per signed-in
     * device, since rotation replaces rather than updates a row. {@code currentRefreshToken} is
     * whatever the caller's own device has locally; when it matches a row, that row is flagged
     * {@code current} so the UI can distinguish "this device" from the rest. Null/absent is fine —
     * the list still returns, just with nothing flagged. */
    List<SessionResponse> listSessions(UUID userId, String currentRefreshToken);

    /** Revokes one specific session by its refresh-token row id. Allowed on the caller's own
     * current session too — functionally identical to signing that device out. */
    void revokeSession(UUID userId, UUID sessionId);

    /** Revokes every active session for this user except the one matching {@code currentRefreshToken}. */
    void revokeOtherSessions(UUID userId, String currentRefreshToken);
}
