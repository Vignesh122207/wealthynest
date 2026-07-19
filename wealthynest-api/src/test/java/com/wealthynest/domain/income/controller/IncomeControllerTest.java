package com.wealthynest.domain.income.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.service.IncomeService;
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
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = IncomeController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class IncomeControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private IncomeService incomeService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateIncomeRequest validRequest() {
        CreateIncomeRequest req = new CreateIncomeRequest();
        req.setSource(IncomeSource.SALARY);
        req.setAmount(new BigDecimal("50000"));
        req.setIncomeDate(LocalDate.of(2026, 6, 1));
        req.setPeriodMonth(6);
        req.setPeriodYear(2026);
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/income"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(incomeService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a period month above 12 fails @Max validation")
        void periodMonthAbove12FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateIncomeRequest req = validRequest();
            req.setPeriodMonth(13);

            mockMvc.perform(post("/api/v1/income")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.periodMonth").exists());
        }

        @Test
        @DisplayName("a non-positive amount fails @Positive validation")
        void nonPositiveAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateIncomeRequest req = validRequest();
            req.setAmount(BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/income")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.amount").exists());
        }
    }

    @Nested
    @DisplayName("three-way GET branching: all / by-year / by-period")
    class GetBranchingTests {

        @Test
        @DisplayName("no year/month params calls getAll")
        void noParamsCallsGetAll() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(incomeService.getAll(userId, false)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/income"))
                    .andExpect(status().isOk());

            verify(incomeService).getAll(userId, false);
            verify(incomeService, never()).getByYear(any(), org.mockito.ArgumentMatchers.anyInt());
            verify(incomeService, never()).getByPeriod(any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyInt(), anyBoolean());
        }

        @Test
        @DisplayName("year param alone (no month) calls getByYear")
        void yearOnlyCallsGetByYear() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(incomeService.getByYear(userId, 2026)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/income").param("year", "2026"))
                    .andExpect(status().isOk());

            verify(incomeService).getByYear(userId, 2026);
            verify(incomeService, never()).getAll(any(), anyBoolean());
        }

        @Test
        @DisplayName("year and month together call getByPeriod")
        void yearAndMonthCallGetByPeriod() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(incomeService.getByPeriod(userId, 2026, 6, false)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/income").param("year", "2026").param("month", "6"))
                    .andExpect(status().isOk());

            verify(incomeService).getByPeriod(userId, 2026, 6, false);
        }
    }

    @Test
    @DisplayName("POST /income creates and returns 201")
    void createReturns201() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(incomeService.create(org.mockito.ArgumentMatchers.eq(userId), any()))
                .thenReturn(IncomeResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/income")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }
}
