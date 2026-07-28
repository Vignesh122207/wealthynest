package com.wealthynest.domain.debt.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.debt.dto.request.CreateDebtRequest;
import com.wealthynest.domain.debt.dto.response.DebtRecordResponse;
import com.wealthynest.domain.debt.entity.DebtType;
import com.wealthynest.domain.debt.service.DebtService;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DebtController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class DebtControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private DebtService debtService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateDebtRequest validRequest() {
        CreateDebtRequest req = new CreateDebtRequest();
        ReflectionTestUtils.setField(req, "type", DebtType.LENT);
        ReflectionTestUtils.setField(req, "contactName", "Alice");
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("500"));
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/debts"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(debtService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a blank contactName fails @NotBlank validation")
        void blankContactNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateDebtRequest req = validRequest();
            ReflectionTestUtils.setField(req, "contactName", "");

            mockMvc.perform(post("/api/v1/debts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.contactName").exists());
        }

        @Test
        @DisplayName("a non-positive amount fails @Positive validation")
        void nonPositiveAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateDebtRequest req = validRequest();
            ReflectionTestUtils.setField(req, "amount", BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/debts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }
    }

    @Nested
    @DisplayName("happy-path delegation and query branching")
    class DelegationTests {

        @Test
        @DisplayName("GET /debts without a type param calls getAll")
        void getAllWithoutTypeCallsGetAll() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(debtService.getAll(userId)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/debts"))
                    .andExpect(status().isOk());

            verify(debtService).getAll(userId);
            verify(debtService, never()).getByType(eq(userId), org.mockito.ArgumentMatchers.any());
        }

        @Test
        @DisplayName("GET /debts?type=LENT calls getByType instead of getAll")
        void getAllWithTypeCallsGetByType() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(debtService.getByType(userId, DebtType.LENT)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/debts").param("type", "LENT"))
                    .andExpect(status().isOk());

            verify(debtService).getByType(userId, DebtType.LENT);
            verify(debtService, never()).getAll(userId);
        }

        @Test
        @DisplayName("POST /debts creates and returns 201")
        void createReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(debtService.create(eq(userId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(DebtRecordResponse.builder().id(UUID.randomUUID()).build());

            mockMvc.perform(post("/api/v1/debts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRequest())))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("PATCH /debts/{id}/settle delegates the authenticated userId")
        void settleDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID debtId = UUID.randomUUID();
            when(debtService.settle(debtId, userId)).thenReturn(DebtRecordResponse.builder().id(debtId).build());

            mockMvc.perform(patch("/api/v1/debts/{id}/settle", debtId))
                    .andExpect(status().isOk());

            verify(debtService).settle(debtId, userId);
        }
    }
}
