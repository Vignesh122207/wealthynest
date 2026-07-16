package com.wealthynest.domain.auth.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.domain.auth.dto.request.AuthOptionsRequest;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.dto.request.GoogleLoginRequest;
import com.wealthynest.domain.auth.dto.request.LoginRequest;
import com.wealthynest.domain.auth.dto.request.PinLoginRequest;
import com.wealthynest.domain.auth.dto.request.RefreshTokenRequest;
import com.wealthynest.domain.auth.dto.request.RegisterRequest;
import com.wealthynest.domain.auth.dto.request.ResetPasswordRequest;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.auth.service.WebAuthnService;
import jakarta.servlet.http.HttpServletRequest;
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

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(authService.register(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"))));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.refresh(request)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @Valid @RequestBody RefreshTokenRequest request, HttpServletRequest httpRequest) {
        authService.logout(request.getRefreshToken(),
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
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
        authService.resetPassword(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/verify-email")
    public ResponseEntity<ApiResponse<Void>> verifyEmail(
            @RequestParam @NotBlank String token, HttpServletRequest httpRequest) {
        authService.verifyEmail(token, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<ApiResponse<Void>> resendVerification(@RequestParam @NotBlank @Email String email) {
        authService.resendVerification(email);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/google-login")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(authService.googleLogin(request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"))));
    }

    @PostMapping("/pin-login")
    public ResponseEntity<ApiResponse<AuthResponse>> pinLogin(
            @Valid @RequestBody PinLoginRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(authService.pinLogin(request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"))));
    }

    @PostMapping("/webauthn/login/options")
    public ResponseEntity<ApiResponse<Map<String, Object>>> webAuthnLoginOptions(@Valid @RequestBody AuthOptionsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.getAuthenticationOptions(request.getEmail())));
    }

    @PostMapping("/webauthn/login/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> webAuthnLoginVerify(
            @RequestBody Map<String, Object> body, HttpServletRequest httpRequest) {
        String email = (String) body.get("email");
        boolean rememberMe = Boolean.TRUE.equals(body.get("rememberMe"));
        @SuppressWarnings("unchecked")
        Map<String, Object> credential = (Map<String, Object>) body.get("credential");
        return ResponseEntity.ok(ApiResponse.success(webAuthnService.verifyAuthentication(
                email, credential, rememberMe,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"))));
    }
}
