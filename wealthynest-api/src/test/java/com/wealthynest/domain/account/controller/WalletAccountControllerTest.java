package com.wealthynest.domain.account.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.account.dto.request.CreateAccountRequest;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.dto.response.TransferResponse;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.service.LoanPaymentService;
import com.wealthynest.domain.account.service.WalletAccountService;
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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * WalletAccountController has NO class-level or (mostly) method-level @PreAuthorize — every
 * endpoint except downloadStatement relies purely on SecurityConfig's URL-level
 * anyRequest().authenticated() rule. This test proves that URL-level defense actually protects
 * these endpoints, which a @WebMvcTest importing only method-security infra (not the real
 * SecurityConfig/filter chain) would never catch.
 */
@WebMvcTest(controllers = WalletAccountController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class WalletAccountControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private WalletAccountService accountService;
    @MockBean private LoanPaymentService loanPaymentService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateAccountRequest validCreateRequest() {
        CreateAccountRequest req = new CreateAccountRequest();
        ReflectionTestUtils.setField(req, "accountType", AccountType.BANK_ACCOUNT);
        ReflectionTestUtils.setField(req, "name", "HDFC Savings");
        ReflectionTestUtils.setField(req, "openingBalance", new BigDecimal("1000"));
        return req;
    }

    private AccountResponse sampleAccount() {
        return AccountResponse.builder().id(UUID.randomUUID()).name("HDFC Savings").build();
    }

    @Nested
    @DisplayName("URL-level authentication (no @PreAuthorize on these endpoints)")
    class UrlLevelAuthTests {

        @Test
        @DisplayName("GET /accounts without auth is rejected by SecurityConfig's URL matcher, not the controller")
        void getAllWithoutAuthIsRejected() throws Exception {
            mockMvc.perform(get("/api/v1/accounts"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        }

        @Test
        @DisplayName("POST /accounts without auth is rejected before the service is called")
        void createWithoutAuthIsRejected() throws Exception {
            mockMvc.perform(post("/api/v1/accounts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isUnauthorized());

            org.mockito.Mockito.verifyNoInteractions(accountService);
        }
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a negative opening balance fails @DecimalMin validation")
        void negativeOpeningBalanceFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateAccountRequest req = validCreateRequest();
            ReflectionTestUtils.setField(req, "openingBalance", new BigDecimal("-100"));

            mockMvc.perform(post("/api/v1/accounts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.openingBalance").exists());
        }

        @Test
        @DisplayName("a zero-amount loan payment fails @DecimalMin(exclusive) validation")
        void zeroLoanPaymentFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(post("/api/v1/accounts/{id}/loan-payment", UUID.randomUUID())
                            .contentType("application/json")
                            .content("""
                                    {"amount": 0}
                                    """))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }

        @Test
        @DisplayName("a transfer to the same account amount validation still requires @Positive amount")
        void transferWithNonPositiveAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            TransferRequest req = new TransferRequest();
            ReflectionTestUtils.setField(req, "fromAccountId", UUID.randomUUID());
            ReflectionTestUtils.setField(req, "toAccountId", UUID.randomUUID());
            ReflectionTestUtils.setField(req, "amount", BigDecimal.ZERO);
            ReflectionTestUtils.setField(req, "transferDate", LocalDate.now());

            mockMvc.perform(post("/api/v1/accounts/transfer")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }
    }

    @Nested
    @DisplayName("happy-path delegation")
    class DelegationTests {

        @Test
        @DisplayName("GET /accounts delegates the authenticated userId and returns the service's list")
        void getAllDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(accountService.getAccounts(userId)).thenReturn(List.of(sampleAccount()));

            mockMvc.perform(get("/api/v1/accounts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("POST /accounts creates an account and returns 201")
        void createReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(accountService.createAccount(eq(userId), org.mockito.ArgumentMatchers.any())).thenReturn(sampleAccount());

            mockMvc.perform(post("/api/v1/accounts")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("DELETE /accounts/{id} passes alsoDeleteTransactions through and returns 204")
        void deletePassesQueryParamThrough() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/accounts/{id}", accountId).param("alsoDeleteTransactions", "true"))
                    .andExpect(status().isNoContent());

            org.mockito.Mockito.verify(accountService).deleteAccount(accountId, userId, true);
        }

        @Test
        @DisplayName("GET /accounts/{id}/statement returns a CSV attachment")
        void downloadStatementReturnsCsv() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.generateStatementCsv(accountId, userId)).thenReturn("date,amount\n".getBytes());

            mockMvc.perform(get("/api/v1/accounts/{id}/statement", accountId))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "text/csv"))
                    .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")));
        }
    }

    @Test
    @DisplayName("POST /accounts/transfer creates a transfer and returns 201")
    void transferReturns201() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        TransferRequest req = new TransferRequest();
        ReflectionTestUtils.setField(req, "fromAccountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "toAccountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("500"));
        ReflectionTestUtils.setField(req, "transferDate", LocalDate.now());
        when(accountService.transfer(eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(TransferResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/accounts/transfer")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());
    }
}
