package com.wealthynest.domain.auth.testsupport;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.json.webtoken.JsonWebSignature;
import com.wealthynest.domain.auth.service.GoogleIdTokenValidator;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.List;

/**
 * Stands in for Google's real Identity Services token issuance + verification so
 * {@code google-oauth.spec.ts} can drive a genuine round trip without a live Google test account.
 * Mints and verifies ID tokens against an in-memory RSA key pair generated fresh on each app start
 * — never Google's real keys, and never reachable unless {@code e2e-oauth-test} is an active
 * Spring profile (see docker-compose.yml's {@code APP_ENV} and the README's Google OAuth section).
 *
 * <p>Deliberately does NOT reuse {@code GoogleIdTokenVerifier}/{@code GooglePublicKeysManager} for
 * the verify side — {@code GooglePublicKeysManager.getPublicKeys()} is {@code final} and always
 * fetches+parses legacy PEM-X.509 certs over HTTP from its configured URL, so there's no supported
 * extension point to hand it an in-memory key instead. Verifying directly against the key pair
 * here, plus the same audience/issuer/expiry checks {@code IdTokenVerifier.verifyPayload()} would
 * otherwise perform, keeps this test double simple and dependency-free (no self-signed X.509
 * certificate or JWKS-serving endpoint needed) while still exercising the real JWT parsing/signing
 * classes ({@code GoogleIdToken}, {@code JsonWebSignature}) Google's own client library provides.
 */
@Slf4j
@Component
@Profile("e2e-oauth-test")
public class TestGoogleIdentityService implements GoogleIdTokenValidator {

    private static final List<String> ACCEPTED_ISSUERS = List.of("accounts.google.com", "https://accounts.google.com");
    private static final long ISSUED_AT_SKEW_SECONDS = 300;

    private final String googleClientId;
    private final KeyPair keyPair;

    public TestGoogleIdentityService(@Value("${wealthynest.google.client-id:}") String googleClientId) throws Exception {
        this.googleClientId = googleClientId;
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        this.keyPair = generator.generateKeyPair();
    }

    @PostConstruct
    void warnActive() {
        log.warn("TestGoogleIdentityService is ACTIVE (e2e-oauth-test profile) — Google Sign-In " +
                "verification is running against a local test key pair, not Google's real certs. " +
                "This must never be active outside a deliberate Playwright OAuth test run.");
    }

    /** Mints a signed, Google-ID-token-shaped JWT for the given identity, using the test key pair. */
    public String issueToken(String email, String name, boolean emailVerified) throws Exception {
        long nowSeconds = Instant.now().getEpochSecond();
        JsonWebSignature.Header header = new JsonWebSignature.Header()
                .setAlgorithm("RS256")
                .setKeyId("test-key-1");
        GoogleIdToken.Payload payload = new GoogleIdToken.Payload()
                .setIssuer("https://accounts.google.com")
                .setAudience(googleClientId)
                .setSubject("test-google-subject-" + email)
                .setEmail(email)
                .setEmailVerified(emailVerified)
                .setIssuedAtTimeSeconds(nowSeconds)
                .setExpirationTimeSeconds(nowSeconds + 3600);
        if (name != null && !name.isBlank()) {
            payload.set("name", name);
        }
        return JsonWebSignature.signUsingRsaSha256(keyPair.getPrivate(), GsonFactory.getDefaultInstance(), header, payload);
    }

    @Override
    public GoogleIdToken.Payload verify(String idTokenString) throws Exception {
        GoogleIdToken idToken = GoogleIdToken.parse(GsonFactory.getDefaultInstance(), idTokenString);
        if (!idToken.verifySignature(keyPair.getPublic())) {
            return null;
        }
        GoogleIdToken.Payload payload = idToken.getPayload();
        long nowSeconds = Instant.now().getEpochSecond();
        if (!ACCEPTED_ISSUERS.contains(payload.getIssuer())) return null;
        if (payload.getAudienceAsList() == null || !payload.getAudienceAsList().contains(googleClientId)) return null;
        if (payload.getExpirationTimeSeconds() == null || payload.getExpirationTimeSeconds() < nowSeconds) return null;
        if (payload.getIssuedAtTimeSeconds() == null || payload.getIssuedAtTimeSeconds() > nowSeconds + ISSUED_AT_SKEW_SECONDS) return null;
        return payload;
    }
}
