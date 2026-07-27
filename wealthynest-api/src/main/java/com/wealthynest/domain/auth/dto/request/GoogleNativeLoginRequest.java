package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

/**
 * Completes the native Android Google sign-in flow: the app only gets an authorization code from
 * the Custom Tab (see GoogleSignInButton.tsx's NativeGoogleSignInButton) — it can't exchange that
 * for an ID token itself, since Google requires a client secret for this OAuth client type even
 * with PKCE, and the app has no safe place to hold one. AuthServiceImpl.googleLoginNative does
 * that exchange server-side instead.
 */
@Getter
public class GoogleNativeLoginRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String redirectUri;

    @NotBlank
    private String codeVerifier;

    private boolean rememberMe;
}
