package com.wealthynest.domain.investment.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
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
import org.springframework.boot.test.mock.mockito.MockBean;
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
    @MockBean private InvestmentService investmentService;

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
    }
}
