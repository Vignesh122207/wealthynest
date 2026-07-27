package com.wealthynest.config;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.wealthynest.domain.auth.service.GoogleIdTokenValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.util.ArrayList;
import java.util.List;

/**
 * Production {@link GoogleIdTokenValidator} — verifies against Google's real, live-fetched certs,
 * unchanged from what {@code AuthServiceImpl} used to build inline. Excluded under the
 * {@code e2e-oauth-test} profile, where {@code testsupport.TestGoogleIdentityService} takes over
 * so the Playwright suite can drive a real round trip without a live Google account.
 */
@Configuration
public class GoogleAuthConfig {

    // Accepts BOTH client IDs so one validator covers both sign-in paths: the web GIS button
    // (ID token minted directly against the "Web application" client) and the native Android flow
    // (ID token minted by Google's token endpoint against the "Desktop app" client, after
    // AuthServiceImpl.googleLoginNative exchanges an authorization code for it server-side). A
    // GoogleIdToken's `aud` claim must match one of these or verify() rejects it outright.
    @Bean
    @Profile("!e2e-oauth-test")
    public GoogleIdTokenValidator googleIdTokenValidator(
            @Value("${wealthynest.google.client-id:}") String googleClientId,
            @Value("${wealthynest.google.native.client-id:}") String googleNativeClientId) {
        List<String> audiences = new ArrayList<>();
        if (!googleClientId.isBlank()) audiences.add(googleClientId);
        if (!googleNativeClientId.isBlank()) audiences.add(googleNativeClientId);

        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(audiences)
                .build();
        return idTokenString -> {
            GoogleIdToken idToken = verifier.verify(idTokenString);
            return idToken == null ? null : idToken.getPayload();
        };
    }
}
