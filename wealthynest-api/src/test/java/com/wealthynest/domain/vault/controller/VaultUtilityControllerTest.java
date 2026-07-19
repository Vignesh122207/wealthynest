package com.wealthynest.domain.vault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultHealthResponse;
import com.wealthynest.domain.vault.service.VaultService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = VaultUtilityController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class VaultUtilityControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private VaultService vaultService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request to /vault/health is rejected before the service is called")
    void unauthenticatedHealthIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/vault/health"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(vaultService);
    }

    @Test
    @DisplayName("GET /vault/health delegates the authenticated userId and returns the service's summary")
    void healthDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(vaultService.getHealthSummary(userId)).thenReturn(
                VaultHealthResponse.builder().totalItems(5).reusedCount(1).weakCount(2).breachedCount(0).build());

        mockMvc.perform(get("/api/v1/vault/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalItems").value(5))
                .andExpect(jsonPath("$.data.reusedCount").value(1));
    }

    @Test
    @DisplayName("POST /vault/export returns a CSV attachment built from the service's export")
    void exportReturnsCsvAttachment() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        RevealVaultItemRequest req = new RevealVaultItemRequest();
        ReflectionTestUtils.setField(req, "currentPassword", "CurrentPass1");
        when(vaultService.exportCsv(eq(userId), any(RevealVaultItemRequest.class), any(), any()))
                .thenReturn("title,username,password\nGitHub,alice,secret\n");

        mockMvc.perform(post("/api/v1/vault/export")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")));
    }
}
