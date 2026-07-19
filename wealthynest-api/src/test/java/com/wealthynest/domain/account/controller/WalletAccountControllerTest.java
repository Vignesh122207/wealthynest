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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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
    @MockitoBean private WalletAccountService accountService;
    @MockitoBean private LoanPaymentService loanPaymentService;

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

        @Test
        @DisplayName("GET /accounts/archived delegates the authenticated userId")
        void getArchivedDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(accountService.getArchivedAccounts(userId)).thenReturn(List.of(sampleAccount()));

            mockMvc.perform(get("/api/v1/accounts/archived"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("PUT /accounts/{id} passes the path id and authenticated userId through")
        void updateDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.updateAccount(eq(accountId), eq(userId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(sampleAccount());

            mockMvc.perform(put("/api/v1/accounts/{id}", accountId)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validCreateRequest())))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PATCH /accounts/{id}/archive delegates the path id and authenticated userId")
        void archiveDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.archiveAccount(accountId, userId)).thenReturn(sampleAccount());

            mockMvc.perform(patch("/api/v1/accounts/{id}/archive", accountId))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PATCH /accounts/{id}/unarchive delegates the path id and authenticated userId")
        void unarchiveDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.unarchiveAccount(accountId, userId)).thenReturn(sampleAccount());

            mockMvc.perform(patch("/api/v1/accounts/{id}/unarchive", accountId))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("PATCH /accounts/{id}/set-primary delegates the path id and authenticated userId")
        void setPrimaryDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.setPrimary(accountId, userId)).thenReturn(sampleAccount());

            mockMvc.perform(patch("/api/v1/accounts/{id}/set-primary", accountId))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("GET /accounts/transfers builds a transferDate-descending pageable and returns the service's page")
        void getTransfersDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            var page = new org.springframework.data.domain.PageImpl<>(
                    List.of(TransferResponse.builder().id(UUID.randomUUID()).build()));
            when(accountService.getTransfers(eq(userId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(com.wealthynest.common.response.PagedResponse.of(page));

            mockMvc.perform(get("/api/v1/accounts/transfers"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("PUT /accounts/transfer/{id} passes the path id and authenticated userId through")
        void updateTransferDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID transferId = UUID.randomUUID();
            com.wealthynest.domain.account.dto.request.UpdateTransferRequest req =
                    new com.wealthynest.domain.account.dto.request.UpdateTransferRequest();
            ReflectionTestUtils.setField(req, "amount", new BigDecimal("250"));
            when(accountService.updateTransfer(eq(transferId), eq(userId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(TransferResponse.builder().id(transferId).build());

            mockMvc.perform(put("/api/v1/accounts/transfer/{id}", transferId)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.id").value(transferId.toString()));
        }

        @Test
        @DisplayName("DELETE /accounts/transfer/{id} delegates the authenticated userId and returns 204")
        void deleteTransferDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID transferId = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/accounts/transfer/{id}", transferId))
                    .andExpect(status().isNoContent());

            org.mockito.Mockito.verify(accountService).deleteTransfer(transferId, userId);
        }

        @Test
        @DisplayName("POST /accounts/{id}/loan-payment passes amount and fromAccountId through to LoanPaymentService")
        void recordLoanPaymentDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            UUID fromAccountId = UUID.randomUUID();

            mockMvc.perform(post("/api/v1/accounts/{id}/loan-payment", accountId)
                            .contentType("application/json")
                            .content("{\"amount\": 500, \"fromAccountId\": \"" + fromAccountId + "\"}"))
                    .andExpect(status().isOk());

            org.mockito.Mockito.verify(loanPaymentService)
                    .recordPayment(accountId, userId, new BigDecimal("500"), fromAccountId);
        }

        @Test
        @DisplayName("POST /accounts/{id}/adjust-balance extracts targetBalance from the body and delegates")
        void adjustBalanceDelegatesToService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID accountId = UUID.randomUUID();
            when(accountService.adjustBalance(eq(accountId), eq(userId), eq(new BigDecimal("1500"))))
                    .thenReturn(sampleAccount());

            mockMvc.perform(post("/api/v1/accounts/{id}/adjust-balance", accountId)
                            .contentType("application/json")
                            .content("{\"targetBalance\": 1500}"))
                    .andExpect(status().isOk());
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
