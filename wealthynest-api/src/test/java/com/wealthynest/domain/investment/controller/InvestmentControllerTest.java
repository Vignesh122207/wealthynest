package com.wealthynest.domain.investment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.request.CreateStockTransactionRequest;
import com.wealthynest.domain.investment.dto.request.DismissDividendRequest;
import com.wealthynest.domain.investment.dto.request.LogIncomeRequest;
import com.wealthynest.domain.investment.dto.response.IncomeHistoryResponse;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.dto.response.SipTransactionResponse;
import com.wealthynest.domain.investment.dto.response.StockTransactionResponse;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.service.InvestmentService;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = InvestmentController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class InvestmentControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private InvestmentService investmentService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateInvestmentRequest validRequest() {
        CreateInvestmentRequest req = new CreateInvestmentRequest();
        ReflectionTestUtils.setField(req, "investmentType", InvestmentType.STOCK);
        ReflectionTestUtils.setField(req, "investedAmount", new BigDecimal("1000"));
        ReflectionTestUtils.setField(req, "currentValue", new BigDecimal("1200"));
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/investments")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isUnauthorized());

        verify(investmentService, never()).createInvestment(any(), any());
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a missing investmentType fails @NotNull validation")
        void missingInvestmentTypeFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateInvestmentRequest req = validRequest();
            ReflectionTestUtils.setField(req, "investmentType", null);

            mockMvc.perform(post("/api/v1/investments")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.investmentType").exists());
        }

        @Test
        @DisplayName("a negative investedAmount fails @PositiveOrZero validation")
        void negativeInvestedAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateInvestmentRequest req = validRequest();
            ReflectionTestUtils.setField(req, "investedAmount", new BigDecimal("-1"));

            mockMvc.perform(post("/api/v1/investments")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.investedAmount").exists());
        }

        @Test
        @DisplayName("a coupon rate above 100 fails @DecimalMax validation")
        void couponRateAbove100FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateInvestmentRequest req = validRequest();
            ReflectionTestUtils.setField(req, "couponRate", new BigDecimal("150"));

            mockMvc.perform(post("/api/v1/investments")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.couponRate").exists());
        }
    }

    @Nested
    @DisplayName("happy-path delegation")
    class DelegationTests {

        @Test
        @DisplayName("POST /investments creates and returns 201")
        void createReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.createInvestment(eq(userId), any()))
                    .thenReturn(InvestmentResponse.builder().id(UUID.randomUUID()).build());

            mockMvc.perform(post("/api/v1/investments")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRequest())))
                    .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("GET /investments returns the authenticated user's list")
        void getAllReturnsUserList() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.getInvestments(userId))
                    .thenReturn(List.of(InvestmentResponse.builder().id(UUID.randomUUID()).build()));

            mockMvc.perform(get("/api/v1/investments"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("DELETE /investments/{id} delegates the authenticated userId")
        void deleteDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/investments/{id}", id))
                    .andExpect(status().isOk());

            verify(investmentService).deleteInvestment(id, userId);
        }

        @Test
        @DisplayName("GET /investments/search/stocks passes the query param through")
        void searchStocksPassesQueryThrough() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.searchStocks("infy")).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/investments/search/stocks").param("q", "infy"))
                    .andExpect(status().isOk());

            verify(investmentService).searchStocks("infy");
        }

        @Test
        @DisplayName("GET /investments/search/stocks without the required q param returns 400 MISSING_PARAMETER, not a 500")
        void searchStocksMissingQueryParamReturns400() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(get("/api/v1/investments/search/stocks"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("MISSING_PARAMETER"));
        }

        @Test
        @DisplayName("GET /investments/type-xirr requires a valid InvestmentType enum value")
        void typeXirrRejectsInvalidEnumValue() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(get("/api/v1/investments/type-xirr").param("type", "NOT_A_TYPE"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_PARAMETER"));
        }

        @Test
        @DisplayName("PUT /investments/{id} updates and returns 200")
        void updateReturns200() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            when(investmentService.updateInvestment(eq(id), eq(userId), any()))
                    .thenReturn(InvestmentResponse.builder().id(id).build());

            mockMvc.perform(put("/api/v1/investments/{id}", id)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRequest())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.id").value(id.toString()));
        }

        @Test
        @DisplayName("GET /investments/search/mf passes the query param through")
        void searchMfPassesQueryThrough() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.searchMF("axis")).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/investments/search/mf").param("q", "axis"))
                    .andExpect(status().isOk());

            verify(investmentService).searchMF("axis");
        }

        @Test
        @DisplayName("GET /investments/gold-price returns all-karat prices")
        void goldPriceReturnsAllKarats() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.getGoldPriceAllKarats())
                    .thenReturn(java.util.Map.of("price22k", new BigDecimal("5500")));

            mockMvc.perform(get("/api/v1/investments/gold-price"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.price22k").value(5500));
        }

        @Test
        @DisplayName("GET /investments/gold-price-info returns karat prices with lastUpdated")
        void goldPriceInfoReturnsDetails() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.getGoldPriceInfo())
                    .thenReturn(java.util.Map.of("price22k", new BigDecimal("5500"), "lastUpdated", "2025-01-01T00:00:00Z"));

            mockMvc.perform(get("/api/v1/investments/gold-price-info"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.lastUpdated").value("2025-01-01T00:00:00Z"));
        }

        @Test
        @DisplayName("GET /investments/dividend-suggestions delegates the authenticated userId")
        void dividendSuggestionsDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.getDividendSuggestions(userId)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/investments/dividend-suggestions"))
                    .andExpect(status().isOk());

            verify(investmentService).getDividendSuggestions(userId);
        }

        @Test
        @DisplayName("POST /investments/{id}/sip creates a SIP transaction and returns 201")
        void addSipReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            CreateSipTransactionRequest req = new CreateSipTransactionRequest();
            req.setTransactionDate(java.time.LocalDate.now());
            req.setAmount(new BigDecimal("5000"));
            when(investmentService.addSipTransaction(eq(id), eq(userId), any()))
                    .thenReturn(SipTransactionResponse.builder().id(1L).build());

            mockMvc.perform(post("/api/v1/investments/{id}/sip", id)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").value(1));
        }

        @Test
        @DisplayName("POST /investments/{id}/sip with a missing amount fails @NotNull validation")
        void addSipMissingAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateSipTransactionRequest req = new CreateSipTransactionRequest();
            req.setTransactionDate(java.time.LocalDate.now());
            req.setAmount(null);

            mockMvc.perform(post("/api/v1/investments/{id}/sip", UUID.randomUUID())
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("GET /investments/{id}/sip returns the investment's SIP ledger")
        void getSipReturnsLedger() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            when(investmentService.getSipTransactions(id, userId))
                    .thenReturn(List.of(SipTransactionResponse.builder().id(1L).build()));

            mockMvc.perform(get("/api/v1/investments/{id}/sip", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("DELETE /investments/{id}/sip/{sipId} delegates the authenticated userId")
        void deleteSipDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/investments/{id}/sip/{sipId}", id, 7L))
                    .andExpect(status().isOk());

            verify(investmentService).deleteSipTransaction(7L, userId);
        }

        @Test
        @DisplayName("GET /investments/{id}/xirr returns the computed XIRR")
        void getXirrReturnsValue() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            when(investmentService.computeXirr(id, userId)).thenReturn(12.5);

            mockMvc.perform(get("/api/v1/investments/{id}/xirr", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").value(12.5));
        }

        @Test
        @DisplayName("GET /investments/portfolio-xirr delegates the authenticated userId")
        void portfolioXirrDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.computePortfolioXirr(userId)).thenReturn(9.0);

            mockMvc.perform(get("/api/v1/investments/portfolio-xirr"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").value(9.0));
        }

        @Test
        @DisplayName("GET /investments/type-xirr with a valid type delegates to the service")
        void typeXirrDelegatesForValidType() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.computeTypeXirr(userId, InvestmentType.STOCK)).thenReturn(15.0);

            mockMvc.perform(get("/api/v1/investments/type-xirr").param("type", "STOCK"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").value(15.0));
        }

        @Test
        @DisplayName("POST /investments/{id}/log-income delegates the authenticated userId")
        void logIncomeDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            LogIncomeRequest req = new LogIncomeRequest();
            req.setIncomeType("DIVIDEND");
            req.setExDate("2025-01-01");
            req.setAmount(new BigDecimal("100"));

            mockMvc.perform(post("/api/v1/investments/{id}/log-income", id)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk());

            verify(investmentService).logIncome(eq(id), eq(userId), any());
        }

        @Test
        @DisplayName("GET /investments/income-history defaults year to the current year when omitted or zero")
        void incomeHistoryDefaultsToCurrentYear() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            int currentYear = java.time.LocalDate.now().getYear();
            when(investmentService.getIncomeHistory(userId, currentYear))
                    .thenReturn(IncomeHistoryResponse.builder().build());

            mockMvc.perform(get("/api/v1/investments/income-history"))
                    .andExpect(status().isOk());

            verify(investmentService).getIncomeHistory(userId, currentYear);
        }

        @Test
        @DisplayName("GET /investments/income-history honors an explicit year param")
        void incomeHistoryHonorsExplicitYear() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(investmentService.getIncomeHistory(userId, 2023))
                    .thenReturn(IncomeHistoryResponse.builder().build());

            mockMvc.perform(get("/api/v1/investments/income-history").param("year", "2023"))
                    .andExpect(status().isOk());

            verify(investmentService).getIncomeHistory(userId, 2023);
        }

        @Test
        @DisplayName("POST /investments/{id}/dismiss-dividend delegates the authenticated userId")
        void dismissDividendDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            DismissDividendRequest req = new DismissDividendRequest();
            ReflectionTestUtils.setField(req, "exDate", "2025-01-01");

            mockMvc.perform(post("/api/v1/investments/{id}/dismiss-dividend", id)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isOk());

            verify(investmentService).dismissDividend(eq(id), eq(userId), any());
        }

        @Test
        @DisplayName("POST /investments/{id}/stock-transactions creates a transaction and returns 201")
        void addStockTransactionReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            CreateStockTransactionRequest req = objectMapper.readValue("""
                    {"transactionDate":"2025-01-01","transactionType":"BUY","quantity":10,"pricePerShare":100}
                    """, CreateStockTransactionRequest.class);
            when(investmentService.addStockTransaction(eq(id), eq(userId), any()))
                    .thenReturn(StockTransactionResponse.builder().id(1L).build());

            mockMvc.perform(post("/api/v1/investments/{id}/stock-transactions", id)
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.id").value(1));
        }

        @Test
        @DisplayName("GET /investments/{id}/stock-transactions returns the investment's transaction ledger")
        void getStockTransactionsReturnsLedger() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();
            when(investmentService.getStockTransactions(id, userId))
                    .thenReturn(List.of(StockTransactionResponse.builder().id(1L).build()));

            mockMvc.perform(get("/api/v1/investments/{id}/stock-transactions", id))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1));
        }

        @Test
        @DisplayName("DELETE /investments/{id}/stock-transactions/{txnId} delegates the authenticated userId")
        void deleteStockTransactionDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID id = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/investments/{id}/stock-transactions/{txnId}", id, 9L))
                    .andExpect(status().isOk());

            verify(investmentService).deleteStockTransaction(id, 9L, userId);
        }
    }
}
