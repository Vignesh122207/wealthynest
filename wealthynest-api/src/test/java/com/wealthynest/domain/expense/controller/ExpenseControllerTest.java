package com.wealthynest.domain.expense.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.entity.PaymentMethod;
import com.wealthynest.domain.expense.service.ExpenseService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * @WebMvcTest slice for ExpenseController: validation (jakarta.validation on the request DTOs),
 * @PreAuthorize("isAuthenticated()") enforcement, and the GlobalExceptionHandler-mapped error
 * shape for a thrown ResourceNotFoundException — none of which the service-layer unit tests can
 * observe, since they call the service directly and never go through Spring MVC's binding,
 * validation, or exception-translation pipeline.
 */
@WebMvcTest(controllers = ExpenseController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class ExpenseControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private ExpenseService expenseService;

    private final UUID userId = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateExpenseRequest validCreateRequest() {
        CreateExpenseRequest req = new CreateExpenseRequest();
        req.setCategoryId(categoryId);
        req.setAccountId(accountId);
        req.setAmount(new BigDecimal("100.00"));
        req.setExpenseDate(LocalDate.of(2026, 6, 1));
        req.setPaymentMethod(PaymentMethod.BANK_ACCOUNT);
        return req;
    }

    private ExpenseResponse sampleResponse() {
        return ExpenseResponse.builder().id(UUID.randomUUID()).userId(userId).categoryId(categoryId)
                .amount(new BigDecimal("100.00")).expenseDate(LocalDate.of(2026, 6, 1)).build();
    }

    @Nested
    @DisplayName("authentication enforcement")
    class AuthenticationTests {

        @Test
        @DisplayName("POST /expenses without an authenticated principal returns the real 401 UNAUTHORIZED body and never reaches the service")
        void createWithoutAuthIsRejected() throws Exception {
            mockMvc.perform(post("/api/v1/expenses")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));

            verify(expenseService, org.mockito.Mockito.never()).createExpense(any(), any(), any());
        }

        @Test
        @DisplayName("GET /expenses/{id} without an authenticated principal returns the real 401 UNAUTHORIZED body and never reaches the service")
        void getByIdWithoutAuthIsRejected() throws Exception {
            mockMvc.perform(get("/api/v1/expenses/{id}", UUID.randomUUID()))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));

            verify(expenseService, org.mockito.Mockito.never()).getExpense(any(), any());
        }
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("missing required fields (categoryId, accountId, amount, expenseDate) return 422 with per-field messages")
        void missingRequiredFieldsReturns422WithFieldErrors() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(post("/api/v1/expenses")
                            .contentType("application/json")
                            .content("{}"))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.fieldErrors.categoryId").exists())
                    .andExpect(jsonPath("$.fieldErrors.accountId").exists())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists())
                    .andExpect(jsonPath("$.fieldErrors.expenseDate").exists());

            verify(expenseService, org.mockito.Mockito.never()).createExpense(any(), any(), any());
        }

        @Test
        @DisplayName("a non-positive amount fails @Positive validation")
        void nonPositiveAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateExpenseRequest req = validCreateRequest();
            req.setAmount(BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/expenses")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }

        @Test
        @DisplayName("malformed JSON body returns 400 MALFORMED_REQUEST rather than a 500")
        void malformedJsonReturns400() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(post("/api/v1/expenses")
                            .contentType("application/json")
                            .content("{not-json"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"));
        }
    }

    @Nested
    @DisplayName("happy-path delegation to the service layer")
    class DelegationTests {

        @Test
        @DisplayName("POST /expenses passes the authenticated userId (not any client-supplied value) to the service")
        void createUsesAuthenticatedUserIdNotClientSupplied() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(expenseService.createExpense(eq(userId), eq(null), any())).thenReturn(sampleResponse());

            mockMvc.perform(post("/api/v1/expenses")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.userId").value(userId.toString()));
        }

        @Test
        @DisplayName("GET /expenses paginates via PagedResponse and reflects page metadata")
        void getAllReturnsPagedResponse() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            Page<ExpenseResponse> page = new PageImpl<>(List.of(sampleResponse()), Pageable.ofSize(50), 1);
            when(expenseService.getExpenses(eq(userId), eq(null), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get("/api/v1/expenses"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data.length()").value(1))
                    .andExpect(jsonPath("$.meta.totalElements").value(1));
        }

        @Test
        @DisplayName("a ResourceNotFoundException thrown by the service maps to a 404 with the standard error shape")
        void getByIdMapsNotFoundToErrorResponse() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID missingId = UUID.randomUUID();
            when(expenseService.getExpense(eq(missingId), eq(userId)))
                    .thenThrow(new ResourceNotFoundException("Expense", "id", missingId));

            mockMvc.perform(get("/api/v1/expenses/{id}", missingId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.path").value("/api/v1/expenses/" + missingId));
        }

        @Test
        @DisplayName("DELETE /expenses/{id} delegates to the service with the authenticated userId and returns 200")
        void deleteDelegatesAndReturnsOk() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(delete("/api/v1/expenses/{id}", UUID.randomUUID()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true));

            verify(expenseService).deleteExpense(any(), eq(userId));
        }

        @Test
        @DisplayName("a non-UUID path variable returns 400 INVALID_PARAMETER, not a 500")
        void invalidUuidPathVariableReturns400() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(get("/api/v1/expenses/{id}", "not-a-uuid"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_PARAMETER"));
        }
    }
}
