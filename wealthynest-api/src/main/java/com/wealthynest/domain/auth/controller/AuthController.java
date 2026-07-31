package com.wealthynest.domain.auth.controller;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.RefreshCookieService;
import com.wealthynest.common.util.ClientIpResolver;
import com.wealthynest.domain.auth.dto.request.*;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.auth.service.WebAuthnService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final WebAuthnService webAuthnService;
    private final RefreshCookieService refreshCookieService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(authService.register(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // Optional — see AuthService#login's own comment for why this lets the server revoke this
        // device's prior session instead of leaving it to accumulate as a duplicate.
        String previousRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ok(authService.login(request, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"), previousRefreshToken), httpResponse);
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        return ok(authService.refresh(requireRefreshCookie(httpRequest),
                clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent")), httpResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        refreshCookieService.read(httpRequest).ifPresent(token ->
                authService.logout(token, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent")));
        refreshCookieService.clear(httpResponse);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
        authService.resetPassword(request, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(
            @RequestParam @NotBlank String token, HttpServletRequest httpRequest) {
        authService.verifyEmail(token, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(@RequestParam @NotBlank @Email String email) {
        authService.resendVerification(email);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/google-login")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // Optional — see AuthService#login's own comment for why this lets the server revoke this
        // device's prior session instead of leaving it to accumulate as a duplicate.
        String previousRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ok(authService.googleLogin(request, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"), previousRefreshToken), httpResponse);
    }

    @PostMapping("/google-login-native")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLoginNative(
            @Valid @RequestBody GoogleCodeLoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String previousRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ok(authService.googleLoginNative(request, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"), previousRefreshToken), httpResponse);
    }

    // Web counterpart — see AuthService.googleLoginPopup's own comment for why this exists
    // alongside googleLogin (One Tap's silent prompt() being blocked/skipped on a lot of mobile
    // browsers).
    @PostMapping("/google-login-popup")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLoginPopup(
            @Valid @RequestBody GoogleCodeLoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String previousRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ok(authService.googleLoginPopup(request, clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent"), previousRefreshToken), httpResponse);
    }

    @PostMapping("/pin-login")
    public ResponseEntity<ApiResponse<AuthResponse>> pinLogin(
            @Valid @RequestBody PinLoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        return ok(authService.pinLogin(request, requireRefreshCookie(httpRequest),
                clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent")), httpResponse);
    }

    @PostMapping("/webauthn/login/options")
    public ResponseEntity<ApiResponse<Map<String, Object>>> webAuthnLoginOptions(@Valid @RequestBody AuthOptionsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.getAuthenticationOptions(request.getEmail())));
    }

    @PostMapping("/webauthn/login/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> webAuthnLoginVerify(
            @Valid @RequestBody WebAuthnLoginVerifyRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // Optional (unlike refresh/pin-login, which require an existing session by definition) —
        // see WebAuthnService#verifyAuthentication for why this lets the server revoke this
        // device's prior session instead of leaving it to accumulate as a duplicate.
        String previousRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ok(webAuthnService.verifyAuthentication(
                request.getEmail(), request.getCredential(), request.isRememberMe(), previousRefreshToken,
                clientIpResolver.resolve(httpRequest), httpRequest.getHeader("User-Agent")), httpResponse);
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private String requireRefreshCookie(HttpServletRequest httpRequest) {
        return refreshCookieService.read(httpRequest)
                .orElseThrow(() -> new BusinessException("Invalid refresh token", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
    }

    /** Every token-issuing endpoint funnels through here: write the rotated refresh token as an
     * httpOnly cookie, then return the response as-is — AuthResponse#refreshToken is
     * {@code @JsonIgnore}d, so it never reaches the response body regardless. */
    private ResponseEntity<ApiResponse<AuthResponse>> ok(AuthResponse authResponse, HttpServletResponse httpResponse) {
        if (authResponse.getRefreshToken() != null) {
            refreshCookieService.write(httpResponse, authResponse.getRefreshToken(), authResponse.getRefreshTokenExpiresInMs());
        }
        return ResponseEntity.ok(ApiResponse.success(authResponse));
    }
}
