package com.wealthynest.domain.liability.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.entity.LiabilityType;
import com.wealthynest.domain.liability.service.LiabilityService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
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

@WebMvcTest(controllers = LiabilityController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class LiabilityControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private LiabilityService liabilityService;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateLiabilityRequest validRequest() {
        CreateLiabilityRequest req = new CreateLiabilityRequest();
        ReflectionTestUtils.setField(req, "name", "Home Loan");
        ReflectionTestUtils.setField(req, "liabilityType", LiabilityType.HOME_LOAN);
        ReflectionTestUtils.setField(req, "principalAmount", new BigDecimal("500000"));
        ReflectionTestUtils.setField(req, "outstandingAmount", new BigDecimal("400000"));
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/liabilities"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(liabilityService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("an interest rate above 100 fails @DecimalMax validation")
        void interestRateAbove100FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateLiabilityRequest req = validRequest();
            ReflectionTestUtils.setField(req, "interestRate", new BigDecimal("150"));

            mockMvc.perform(post("/api/v1/liabilities")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.interestRate").exists());
        }

        @Test
        @DisplayName("a negative outstandingAmount fails @PositiveOrZero validation")
        void negativeOutstandingFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateLiabilityRequest req = validRequest();
            ReflectionTestUtils.setField(req, "outstandingAmount", new BigDecimal("-1"));

            mockMvc.perform(post("/api/v1/liabilities")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.outstandingAmount").exists());
        }
    }

    @Test
    @DisplayName("POST /liabilities passes the server-resolved familyId (not client-supplied) to the service")
    void createPassesServerResolvedFamilyId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(liabilityService.createLiability(eq(userId), eq(familyId), any()))
                .thenReturn(LiabilityResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/liabilities")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("DELETE /liabilities/{id} delegates the authenticated userId")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/liabilities/{id}", id))
                .andExpect(status().isOk());

        verify(liabilityService).deleteLiability(id, userId);
    }

    @Test
    @DisplayName("GET /liabilities delegates the authenticated userId and family id")
    void getAllDelegatesUserAndFamilyId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(liabilityService.getLiabilities(userId, familyId))
                .thenReturn(java.util.List.of(LiabilityResponse.builder().id(UUID.randomUUID()).build()));

        mockMvc.perform(get("/api/v1/liabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("PUT /liabilities/{id} passes the path id, authenticated userId, and body through to the service")
    void updateDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        when(liabilityService.updateLiability(eq(id), eq(userId), any()))
                .thenReturn(LiabilityResponse.builder().id(id).name("Home Loan").build());

        mockMvc.perform(put("/api/v1/liabilities/{id}", id)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }
}
