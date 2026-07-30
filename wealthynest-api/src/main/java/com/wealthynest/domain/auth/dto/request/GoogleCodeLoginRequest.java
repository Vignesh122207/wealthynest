package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

/**
 * Completes an authorization-code Google sign-in: the client only gets a code (not an ID token)
 * out of the flow, and can't exchange that for one itself — Google requires a client secret for
 * that exchange that the client can't safely hold. AuthServiceImpl exchanges it server-side
 * instead, for either caller of this DTO:
 *  - the native Android Custom Tab flow (GoogleSignInButton.tsx's NativeGoogleSignInButton /
 *    AuthServiceImpl.googleLoginNative), which always sends a real PKCE codeVerifier;
 *  - the web popup fallback (WebGoogleSignInButton's runPopupFallback / AuthServiceImpl
 *    .googleLoginPopup), used when One Tap's silent prompt() is blocked/skipped, which has no
 *    codeVerifier — GIS's initCodeClient popup mode doesn't expose PKCE — so that field is left
 *    blank rather than faked.
 */
@Getter
public class GoogleCodeLoginRequest {
    @NotBlank
    private String code;

    @NotBlank
    private String redirectUri;

    /** Blank for the web popup fallback (see class doc) — not required. */
    private String codeVerifier;

    private boolean rememberMe;
}
