package com.wealthynest.testsupport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Shared register -> verify -> login flow for full-stack ({@code @SpringBootTest}) integration
 * tests that need a real, working access token rather than exercising auth itself (see
 * {@code AuthFlowIntegrationTest} for that). Mirrors the email-verification workaround documented
 * there: a freshly registered account is unverified by design, so this flips it directly via the
 * repository rather than driving the (unwired-in-tests) email-link flow. */
public final class IntegrationAuthHelper {

    private IntegrationAuthHelper() {}

    public record AuthResult(UUID userId, String accessToken, String refreshToken) {}

    public static AuthResult registerVerifyAndLogin(MockMvc mockMvc, ObjectMapper objectMapper,
                                                      UserRepository userRepository,
                                                      String email, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType("application/json")
                        .content("""
                                {"fullName":"Test User","email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isCreated());

        User user = userRepository.findByEmail(email).orElseThrow();
        user.setEmailVerified(true);
        userRepository.save(user);

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("data");
        return new AuthResult(user.getId(), data.get("accessToken").asText(), data.get("refreshToken").asText());
    }
}
