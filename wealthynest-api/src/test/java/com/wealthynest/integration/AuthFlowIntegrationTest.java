package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.testsupport.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Exercises the real HTTP layer, real SecurityFilterChain/JWT parsing, real password hashing, and
 * real Postgres/Redis (via Testcontainers) end to end — register through logout — the way no
 * service-layer or @WebMvcTest slice test can, since those mock out exactly the boundaries this
 * test is meant to cross. A freshly registered account is unverified and gets no tokens by
 * design (AuthServiceImpl.register), so this test flips emailVerified directly via the repository
 * to reach the login-eligible state — verifying the email-link delivery mechanism itself is out
 * of scope here (there's no test SMTP server wired up).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AuthFlowIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("register (unverified, no tokens) -> blocked login -> verify -> login -> access protected resource -> refresh rotates tokens -> logout revokes -> reuse fails")
    void fullAuthLifecycle() throws Exception {
        String email = "flow-" + UUID.randomUUID() + "@example.com";
        String password = "Passw0rd1";

        // 1. Register: 201, but no tokens yet — email isn't verified
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType("application/json")
                        .content("""
                                {"fullName":"Flow Tester","email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.user.email").value(email));

        // 2. Login before verification is rejected
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("EMAIL_NOT_VERIFIED"));

        // 3. Mark verified directly (standing in for clicking the emailed link)
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setEmailVerified(true);
        userRepository.save(user);

        // 4. Login now succeeds and returns real, working tokens
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").exists())
                .andExpect(jsonPath("$.data.refreshToken").exists())
                .andReturn();

        JsonNode loginData = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("data");
        String accessToken = loginData.get("accessToken").asText();
        String refreshToken = loginData.get("refreshToken").asText();

        // 5. The access token authenticates a protected endpoint
        mockMvc.perform(get("/api/v1/expenses").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        // 6. The same endpoint without a token is rejected
        mockMvc.perform(get("/api/v1/expenses"))
                .andExpect(status().isUnauthorized());

        // 7. Refresh rotates the token: issues a new pair and revokes the one just used.
        MvcResult refreshResult = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s"}
                                """.formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").exists())
                .andReturn();
        String rotatedRefreshToken = objectMapper.readTree(refreshResult.getResponse().getContentAsString())
                .get("data").get("refreshToken").asText();
        assertThat(rotatedRefreshToken).isNotEqualTo(refreshToken);

        // 8. Reusing the now-rotated-away original refresh token fails
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s"}
                                """.formatted(refreshToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"));

        // 9. Logout revokes the current refresh token
        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s"}
                                """.formatted(rotatedRefreshToken)))
                .andExpect(status().isOk());

        // 10. The logged-out refresh token can no longer be used
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s"}
                                """.formatted(rotatedRefreshToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"));
    }

    @Test
    @DisplayName("registering the same email twice is rejected with 409 EMAIL_EXISTS")
    void duplicateRegistrationIsRejected() throws Exception {
        String email = "dup-" + UUID.randomUUID() + "@example.com";
        String body = """
                {"fullName":"Dup Tester","email":"%s","password":"Passw0rd1"}
                """.formatted(email);

        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("EMAIL_EXISTS"));
    }

    @Test
    @DisplayName("five consecutive wrong passwords lock the account (persists across the rejected-login " +
            "transaction), then even the correct password is rejected until the lockout expires")
    void repeatedBadPasswordsLockAccount() throws Exception {
        String email = "lockout-" + UUID.randomUUID() + "@example.com";
        String password = "Passw0rd1";
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content("""
                        {"fullName":"Lockout Tester","email":"%s","password":"%s"}
                        """.formatted(email, password)))
                .andExpect(status().isCreated());
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setEmailVerified(true);
        userRepository.save(user);

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content("""
                            {"email":"%s","password":"wrong-password"}
                            """.formatted(email)))
                    .andExpect(status().isUnauthorized());
        }

        // the 5th failure's lockout write survives even though login() re-throws BadCredentialsException
        user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getFailedLoginAttempts()).isZero(); // reset back to 0 once locked
        assertThat(user.getLockedUntil()).isNotNull().isAfter(java.time.Instant.now());

        // even the correct password is rejected while locked
        mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content("""
                        {"email":"%s","password":"%s"}
                        """.formatted(email, password)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("ACCOUNT_INACTIVE"));
    }

    @Test
    @DisplayName("refreshing immediately after login succeeds — two tokens minted for the same user within " +
            "the same second get distinct jtis and don't collide on refresh_tokens_token_hash_key")
    void refreshImmediatelyAfterLoginSucceeds() throws Exception {
        String email = "collide-" + UUID.randomUUID() + "@example.com";
        String password = "Passw0rd1";
        mockMvc.perform(post("/api/v1/auth/register").contentType("application/json").content("""
                        {"fullName":"Collide Tester","email":"%s","password":"%s"}
                        """.formatted(email, password)))
                .andExpect(status().isCreated());
        User user = userRepository.findByEmail(email).orElseThrow();
        user.setEmailVerified(true);
        userRepository.save(user);

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login").contentType("application/json").content("""
                        {"email":"%s","password":"%s"}
                        """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        String refreshToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("data").get("refreshToken").asText();

        // no delay — this used to collide when login() and refresh() landed in the same second
        mockMvc.perform(post("/api/v1/auth/refresh").contentType("application/json").content("""
                        {"refreshToken":"%s"}
                        """.formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").exists())
                .andExpect(jsonPath("$.data.refreshToken").exists());
    }
}
