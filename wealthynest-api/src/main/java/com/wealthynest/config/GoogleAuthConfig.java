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

import java.util.Collections;

/**
 * Production {@link GoogleIdTokenValidator} — verifies against Google's real, live-fetched certs,
 * unchanged from what {@code AuthServiceImpl} used to build inline. Excluded under the
 * {@code e2e-oauth-test} profile, where {@code testsupport.TestGoogleIdentityService} takes over
 * so the Playwright suite can drive a real round trip without a live Google account.
 */
@Configuration
public class GoogleAuthConfig {

    @Bean
    @Profile("!e2e-oauth-test")
    public GoogleIdTokenValidator googleIdTokenValidator(@Value("${wealthynest.google.client-id:}") String googleClientId) {
        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(Collections.singletonList(googleClientId))
                .build();
        return idTokenString -> {
            GoogleIdToken idToken = verifier.verify(idTokenString);
            return idToken == null ? null : idToken.getPayload();
        };
    }
}
