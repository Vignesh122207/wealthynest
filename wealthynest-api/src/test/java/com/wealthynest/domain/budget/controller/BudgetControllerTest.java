package com.wealthynest.domain.budget.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.service.BudgetService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
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

/**
 * BudgetController delegates the caller's familyId (resolved server-side via
 * SecurityUtils.getCurrentFamilyId(), never client-supplied) to the service — the tests here
 * confirm a user with no family gets a null familyId passed through rather than an error, and
 * that a family member's familyId is actually threaded into the shared-budget path.
 */
@WebMvcTest(controllers = BudgetController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class BudgetControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private BudgetService budgetService;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateBudgetRequest validCreateRequest() {
        CreateBudgetRequest req = new CreateBudgetRequest();
        ReflectionTestUtils.setField(req, "categoryId", categoryId);
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("5000"));
        return req;
    }

    private BudgetResponse sampleResponse() {
        return BudgetResponse.builder().id(UUID.randomUUID()).categoryId(categoryId)
                .amount(new BigDecimal("5000")).build();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected with the real 401 body before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/budgets")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validCreateRequest())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));

        verify(budgetService, never()).createOrUpdateBudget(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a zero amount fails @Positive validation")
        void zeroAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateBudgetRequest req = validCreateRequest();
            ReflectionTestUtils.setField(req, "amount", BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/budgets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }

        @Test
        @DisplayName("an alertThreshold above 100 fails @DecimalMax validation")
        void alertThresholdAbove100FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateBudgetRequest req = validCreateRequest();
            ReflectionTestUtils.setField(req, "alertThreshold", new BigDecimal("150"));

            mockMvc.perform(post("/api/v1/budgets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.alertThreshold").exists());
        }

        @Test
        @DisplayName("a missing categoryId fails @NotNull validation")
        void missingCategoryIdFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateBudgetRequest req = validCreateRequest();
            ReflectionTestUtils.setField(req, "categoryId", null);

            mockMvc.perform(post("/api/v1/budgets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.categoryId").exists());
        }
    }

    @Nested
    @DisplayName("family-scoping delegation")
    class FamilyScopingTests {

        @Test
        @DisplayName("a user with no family gets a null familyId threaded through, not an error")
        void userWithNoFamilyPassesNullFamilyId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(budgetService.createOrUpdateBudget(eq(userId), eq(null), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(sampleResponse());

            mockMvc.perform(post("/api/v1/budgets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("a family member's server-resolved familyId (not any client-supplied value) reaches the service")
        void familyMemberPassesServerResolvedFamilyId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, familyId);
            when(budgetService.createOrUpdateBudget(eq(userId), eq(familyId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(sampleResponse());

            mockMvc.perform(post("/api/v1/budgets")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.categoryId").value(categoryId.toString()));
        }

        @Test
        @DisplayName("GET /budgets defaults year/month to the current period when omitted")
        void getBudgetsDefaultsToCurrentPeriod() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            var now = java.time.LocalDate.now();
            when(budgetService.getBudgets(eq(userId), eq(null), eq(now.getYear()), eq(now.getMonthValue())))
                    .thenReturn(List.of(sampleResponse()));

            mockMvc.perform(get("/api/v1/budgets"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }
    }

    @Test
    @DisplayName("DELETE /budgets/{id} delegates the authenticated userId and returns 200")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID budgetId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/budgets/{id}", budgetId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(budgetService).deleteBudget(eq(budgetId), eq(userId), eq(null));
    }
}
