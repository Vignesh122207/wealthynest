package com.wealthynest.domain.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;

/**
 * Verifies a Google Identity Services ID token and returns its payload. Extracted as an interface
 * so {@code e2e-oauth-test} profile can swap in a test double that verifies against a locally
 * generated key pair instead of Google's real certs — see {@code GoogleAuthConfig} for the
 * production bean and {@code testsupport.TestGoogleIdentityService} for the test one.
 */
public interface GoogleIdTokenValidator {
    /** Returns the verified payload, or {@code null} if the token doesn't verify. */
    GoogleIdToken.Payload verify(String idTokenString) throws Exception;
}
