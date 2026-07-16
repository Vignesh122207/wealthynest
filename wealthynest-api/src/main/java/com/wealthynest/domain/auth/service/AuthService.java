package com.wealthynest.domain.auth.service;

import com.wealthynest.domain.auth.dto.request.ChangeEmailRequest;
import com.wealthynest.domain.auth.dto.request.EnablePinRequest;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.dto.request.GoogleLoginRequest;
import com.wealthynest.domain.auth.dto.request.LoginRequest;
import com.wealthynest.domain.auth.dto.request.PinLoginRequest;
import com.wealthynest.domain.auth.dto.request.RefreshTokenRequest;
import com.wealthynest.domain.auth.dto.request.RegisterRequest;
import com.wealthynest.domain.auth.dto.request.ResetPasswordRequest;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import java.util.UUID;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request, String ipAddress, String userAgent);
    AuthResponse refresh(RefreshTokenRequest request);
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
    AuthResponse pinLogin(PinLoginRequest request, String ipAddress, String userAgent);
    AuthResponse googleLogin(GoogleLoginRequest request, String ipAddress, String userAgent);
    /** Issues tokens for a user already authenticated by another factor (passkey) — the same
     * token-issuing core password/PIN login use, exposed for WebAuthnServiceImpl to reuse. */
    AuthResponse issueTokensForVerifiedUser(UUID userId, boolean rememberMe);
}
