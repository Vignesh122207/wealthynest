package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.testsupport.AbstractIntegrationTest;
import com.wealthynest.testsupport.IntegrationAuthHelper;
import com.wealthynest.testsupport.IntegrationAuthHelper.AuthResult;
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

/** Exercises device-local PIN quick-reauth over the real HTTP/security/DB stack: enabling a PIN
 * (requires the real password), logging in with it (rotates the refresh token, same as /refresh),
 * wrong-PIN lockout after 5 attempts, and disabling it. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class PinLoginIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("enabling a PIN requires the real password, and logging in with it rotates the refresh token and updates the protected profile flag")
    void enablePinThenLoginWithItRotatesToken() throws Exception {
        String password = "Passw0rd1";
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "pin-login-" + UUID.randomUUID() + "@example.com", password);

        // Wrong current password is rejected outright, before the PIN is ever set.
        mockMvc.perform(post("/api/v1/users/me/pin/enable")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"wrong-password","pin":"1234"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/users/me/pin/enable")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"%s","pin":"1234"}
                                """.formatted(password)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pinEnabled").value(true));

        // Login with the PIN against the refresh token — succeeds and rotates it, same as /refresh.
        MvcResult pinLoginResult = mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s","pin":"1234"}
                                """.formatted(auth.refreshToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode pinLoginData = objectMapper.readTree(pinLoginResult.getResponse().getContentAsString()).get("data");
        String newRefreshToken = pinLoginData.get("refreshToken").asText();
        assertThat(newRefreshToken).isNotEqualTo(auth.refreshToken());
        assertThat(pinLoginData.get("accessToken").asText()).isNotBlank();

        // The original (now-rotated-away) refresh token can no longer log in via PIN.
        mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s","pin":"1234"}
                                """.formatted(auth.refreshToken())))
                .andExpect(status().isUnauthorized());

        // Disabling the PIN clears the profile flag and blocks further PIN logins on this token.
        mockMvc.perform(post("/api/v1/users/me/pin/disable")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/users/me").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pinEnabled").value(false));
        mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s","pin":"1234"}
                                """.formatted(newRefreshToken)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("five wrong PINs lock further PIN attempts, even with the correct PIN, while password login remains unaffected")
    void repeatedWrongPinsLockPinLoginButNotPasswordLogin() throws Exception {
        String email = "pin-lockout-" + UUID.randomUUID() + "@example.com";
        String password = "Passw0rd1";
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository, email, password);

        mockMvc.perform(post("/api/v1/users/me/pin/enable")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"currentPassword":"%s","pin":"5678"}
                                """.formatted(password)))
                .andExpect(status().isOk());

        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/v1/auth/pin-login")
                            .contentType("application/json")
                            .content("""
                                    {"refreshToken":"%s","pin":"0000"}
                                    """.formatted(auth.refreshToken())))
                    .andExpect(status().isUnauthorized());
        }

        // Locked now — even the correct PIN is rejected.
        mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s","pin":"5678"}
                                """.formatted(auth.refreshToken())))
                .andExpect(status().isLocked());

        // Password login is a completely separate lockout counter — unaffected by PIN attempts.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("PIN login is rejected for an account that never enabled one")
    void pinLoginRejectedWhenNotEnabled() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "pin-not-enabled-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("""
                                {"refreshToken":"%s","pin":"1234"}
                                """.formatted(auth.refreshToken())))
                .andExpect(status().isBadRequest());
    }
}
