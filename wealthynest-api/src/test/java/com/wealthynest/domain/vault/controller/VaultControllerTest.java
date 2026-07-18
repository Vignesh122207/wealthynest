package com.wealthynest.domain.vault.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.request.VaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemSecretResponse;
import com.wealthynest.domain.vault.entity.VaultItemType;
import com.wealthynest.domain.vault.service.VaultService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = VaultController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class VaultControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private VaultService vaultService;

    private final UUID userId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private VaultItemRequest validRequest() {
        VaultItemRequest req = new VaultItemRequest();
        ReflectionTestUtils.setField(req, "itemType", VaultItemType.LOGIN);
        ReflectionTestUtils.setField(req, "title", "GitHub");
        ReflectionTestUtils.setField(req, "secret", "s3cret-pw");
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/vault/items"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(vaultService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a blank title fails @NotBlank validation")
        void blankTitleFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            VaultItemRequest req = validRequest();
            ReflectionTestUtils.setField(req, "title", "");

            mockMvc.perform(post("/api/v1/vault/items")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.title").exists());
        }

        @Test
        @DisplayName("a missing itemType fails @NotNull validation")
        void missingItemTypeFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            VaultItemRequest req = validRequest();
            ReflectionTestUtils.setField(req, "itemType", null);

            mockMvc.perform(post("/api/v1/vault/items")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.itemType").exists());
        }
    }

    @Test
    @DisplayName("POST /vault/items creates and returns 201, never echoing the secret back")
    void createReturns201AndNeverEchoesSecret() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(vaultService.createItem(eq(userId), any()))
                .thenReturn(VaultItemResponse.builder().id(itemId).title("GitHub").build());

        mockMvc.perform(post("/api/v1/vault/items")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(itemId.toString()))
                .andExpect(jsonPath("$.data.secret").doesNotExist());
    }

    @Test
    @DisplayName("GET /vault/items/{id} delegates the authenticated userId")
    void getOneDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(vaultService.getItem(itemId, userId)).thenReturn(VaultItemResponse.builder().id(itemId).build());

        mockMvc.perform(get("/api/v1/vault/items/{id}", itemId))
                .andExpect(status().isOk());

        verify(vaultService).getItem(itemId, userId);
    }

    @Test
    @DisplayName("GET /vault/items/{id} returns 403 when the service reports another owner")
    void getOneReturns403WhenNotOwned() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(vaultService.getItem(itemId, userId)).thenThrow(new AccessDeniedException());

        mockMvc.perform(get("/api/v1/vault/items/{id}", itemId))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("DELETE /vault/items/{id} delegates the authenticated userId")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(delete("/api/v1/vault/items/{id}", itemId))
                .andExpect(status().isOk());

        verify(vaultService).deleteItem(itemId, userId);
    }

    @Test
    @DisplayName("PATCH /vault/items/{id}/favorite delegates the authenticated userId")
    void toggleFavoriteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(vaultService.toggleFavorite(itemId, userId)).thenReturn(VaultItemResponse.builder().id(itemId).favorite(true).build());

        mockMvc.perform(patch("/api/v1/vault/items/{id}/favorite", itemId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.favorite").value(true));
    }

    @Nested
    @DisplayName("POST /vault/items/{id}/reveal")
    class RevealTests {

        @Test
        @DisplayName("a request with neither currentPassword nor stepUpToken reaches the service, which rejects it")
        void blankPasswordWithNoTokenIsRejectedByService() throws Exception {
            // currentPassword is no longer @NotBlank at the DTO level — a stepUpToken (Phase 5's
            // "trust this device") is now a valid alternative, so this is a service-layer 400
            // (see VaultServiceImplTest's requireStepUp tests), not a controller-level 422.
            SecurityTestUtils.authenticateAs(userId, null);
            RevealVaultItemRequest req = new RevealVaultItemRequest();
            ReflectionTestUtils.setField(req, "currentPassword", "");
            when(vaultService.revealSecret(eq(itemId), eq(userId), any(), any(), any()))
                    .thenThrow(new BusinessException("Account password is required.", HttpStatus.BAD_REQUEST));

            mockMvc.perform(post("/api/v1/vault/items/{id}/reveal", itemId)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns the decrypted secret on success")
        void returnsDecryptedSecretOnSuccess() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            RevealVaultItemRequest req = new RevealVaultItemRequest();
            ReflectionTestUtils.setField(req, "currentPassword", "correct-password");
            when(vaultService.revealSecret(eq(itemId), eq(userId), any(), any(), any()))
                    .thenReturn(VaultItemSecretResponse.builder().id(itemId).secret("plaintext-secret").build());

            mockMvc.perform(post("/api/v1/vault/items/{id}/reveal", itemId)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.secret").value("plaintext-secret"));
        }
    }
}
