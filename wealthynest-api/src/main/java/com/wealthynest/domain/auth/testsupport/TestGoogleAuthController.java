package com.wealthynest.domain.auth.testsupport;

import com.wealthynest.common.response.ApiResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Test-only surface for {@code google-oauth.spec.ts} to mint a Google-ID-token-shaped JWT it can
 * feed into the real {@code GoogleSignInButton}/{@code POST /auth/google-login} flow. Only exists
 * as a bean under the {@code e2e-oauth-test} profile (see {@link TestGoogleIdentityService}) — the
 * class itself, and therefore this route, is never registered in a normal deployment. Mapped under
 * {@code /api/v1/auth/**} to reuse that prefix's existing {@code permitAll} rule in SecurityConfig
 * rather than adding a new one.
 */
@RestController
@RequestMapping("/api/v1/auth/test")
@RequiredArgsConstructor
@Profile("e2e-oauth-test")
public class TestGoogleAuthController {
    private final TestGoogleIdentityService testGoogleIdentityService;

    public record IssueTokenRequest(
            @NotBlank @Email String email,
            String name,
            Boolean emailVerified) {
    }

    @PostMapping("/google-issue-token")
    public ResponseEntity<ApiResponse<Map<String, String>>> issueToken(@RequestBody IssueTokenRequest request) throws Exception {
        String idToken = testGoogleIdentityService.issueToken(
                request.email(), request.name(), request.emailVerified() == null || request.emailVerified());
        return ResponseEntity.ok(ApiResponse.success(Map.of("idToken", idToken)));
    }
}
