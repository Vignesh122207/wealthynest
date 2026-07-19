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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the WebAuthn/passkey endpoints over the real HTTP/security/Redis/DB stack.
 * <p>
 * A genuine successful registration or login round-trip needs a real browser-signed attestation
 * object — WebAuthnServiceImplTest documents that this can't be meaningfully synthesized in a
 * test (no webauthn4j-test authenticator dependency is on the classpath here), so, matching that
 * same documented approach, this test targets what real integration coverage adds over the
 * existing @WebMvcTest (which mocks WebAuthnService entirely): the real Redis-backed challenge
 * issuance/expiry, the real repository-backed passkey list/delete lifecycle, and the real
 * exception-to-HTTP-status mapping for malformed/missing credentials — none of which a mocked
 * service can catch. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class WebAuthnIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("registration options issue a real, well-shaped WebAuthn challenge over Redis, and a malformed credential is rejected through the real verification+exception-mapping chain")
    void registrationOptionsAndMalformedVerifyRejection() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "webauthn-reg-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        MvcResult optionsResult = mockMvc.perform(post("/api/v1/users/me/webauthn/register/options")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode options = objectMapper.readTree(optionsResult.getResponse().getContentAsString()).get("data");
        assertThat(options.get("challenge")).isNotNull();
        assertThat(options.get("rp").get("id").asText()).isEqualTo("localhost");
        assertThat(options.get("user").get("name").asText()).isNotBlank();

        // No real authenticator exists to sign the challenge — an obviously-malformed credential
        // payload must be rejected via the real webauthn4j verification + BusinessException
        // mapping, not silently accepted or a raw 500.
        mockMvc.perform(post("/api/v1/users/me/webauthn/register/verify")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"credential":{"id":"not-a-real-credential","rawId":"bm90LXJlYWw=","type":"public-key",
                                  "response":{"clientDataJSON":"bm90LXJlYWw=","attestationObject":"bm90LXJlYWw="}},
                                 "nickname":"My Phone"}
                                """))
                .andExpect(status().isBadRequest());

        // No passkey exists yet since verification never succeeded.
        mockMvc.perform(get("/api/v1/users/me/webauthn/passkeys")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("registration verify without first requesting options is rejected as expired, not a raw error")
    void registrationVerifyWithoutOptionsIsRejectedAsExpired() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "webauthn-noopt-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        mockMvc.perform(post("/api/v1/users/me/webauthn/register/verify")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"credential":{"id":"x"},"nickname":"Phone"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("expired")));
    }

    @Test
    @DisplayName("deleting a passkey that doesn't belong to (or exist for) the caller is a 404, not silently ignored")
    void deletingNonexistentPasskeyReturns404() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "webauthn-delete-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        mockMvc.perform(delete("/api/v1/users/me/webauthn/passkeys/" + UUID.randomUUID())
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("login options for an unknown email and for a real account with no registered passkeys" +
            " both return the same 200 with an empty allowCredentials — enumeration guard")
    void loginOptionsForUnknownEmailAndNoPasskeys() throws Exception {
        String email = "webauthn-login-" + UUID.randomUUID() + "@example.com";
        IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository, email, "Passw0rd1");

        mockMvc.perform(post("/api/v1/auth/webauthn/login/options")
                        .contentType("application/json")
                        .content("""
                                {"email":"nobody-%s@example.com"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allowCredentials").isEmpty());

        mockMvc.perform(post("/api/v1/auth/webauthn/login/options")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.allowCredentials").isEmpty());
    }
}
