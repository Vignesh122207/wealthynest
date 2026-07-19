package com.wealthynest.domain.asset.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.asset.service.AssetService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AssetController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class AssetControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private AssetService assetService;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateAssetRequest validRequest() {
        CreateAssetRequest req = new CreateAssetRequest();
        ReflectionTestUtils.setField(req, "name", "House");
        ReflectionTestUtils.setField(req, "assetType", AssetType.REAL_ESTATE);
        ReflectionTestUtils.setField(req, "currentValue", new BigDecimal("5000000"));
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/assets"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(assetService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a blank name fails @NotBlank validation")
        void blankNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateAssetRequest req = validRequest();
            ReflectionTestUtils.setField(req, "name", "");

            mockMvc.perform(post("/api/v1/assets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.name").exists());
        }

        @Test
        @DisplayName("a negative currentValue fails @PositiveOrZero validation")
        void negativeCurrentValueFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateAssetRequest req = validRequest();
            ReflectionTestUtils.setField(req, "currentValue", new BigDecimal("-1"));

            mockMvc.perform(post("/api/v1/assets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.currentValue").exists());
        }
    }

    @Test
    @DisplayName("GET /assets/net-worth passes the server-resolved familyId to the service")
    void netWorthUsesServerResolvedFamilyId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(assetService.getTotalNetWorth(userId, familyId)).thenReturn(new BigDecimal("12345.67"));

        mockMvc.perform(get("/api/v1/assets/net-worth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(12345.67));
    }

    @Test
    @DisplayName("POST /assets creates and returns 201")
    void createReturns201() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(assetService.createAsset(eq(userId), eq(null), any()))
                .thenReturn(AssetResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/assets")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("DELETE /assets/{id} delegates the authenticated userId")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/assets/{id}", id))
                .andExpect(status().isOk());

        verify(assetService).deleteAsset(id, userId);
    }
}
