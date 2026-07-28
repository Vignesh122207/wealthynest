package com.wealthynest.domain.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.auth.dto.response.PasskeyResponse;
import com.wealthynest.domain.auth.service.WebAuthnService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = WebAuthnController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class WebAuthnControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private WebAuthnService webAuthnService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called — passkey management requires auth unlike webauthn login")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/webauthn/passkeys"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(webAuthnService);
    }

    @Test
    @DisplayName("GET /passkeys returns the authenticated user's passkeys")
    void passkeysReturnsUserList() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(webAuthnService.listPasskeys(userId)).thenReturn(List.of(
                PasskeyResponse.builder().id(UUID.randomUUID()).build()));

        mockMvc.perform(get("/api/v1/users/me/webauthn/passkeys"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("DELETE /passkeys/{id} delegates the authenticated userId")
    void deletePasskeyDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID passkeyId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/users/me/webauthn/passkeys/{id}", passkeyId))
                .andExpect(status().isOk());

        verify(webAuthnService).deletePasskey(userId, passkeyId);
    }

    @Test
    @DisplayName("POST /register/verify extracts credential and nickname from the raw body and delegates them")
    void registrationVerifyExtractsCredentialAndNickname() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        Map<String, Object> body = Map.of("credential", Map.of("id", "abc"), "nickname", "My Phone");

        mockMvc.perform(post("/api/v1/users/me/webauthn/register/verify")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(webAuthnService).verifyRegistration(org.mockito.ArgumentMatchers.eq(userId), any(), org.mockito.ArgumentMatchers.eq("My Phone"));
    }
}
