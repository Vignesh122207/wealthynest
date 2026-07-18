package com.wealthynest.domain.analytics.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.analytics.dto.response.DashboardResponse;
import com.wealthynest.domain.analytics.service.AnalyticsService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AnalyticsController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class AnalyticsControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private AnalyticsService analyticsService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/analytics/dashboard"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(analyticsService);
    }

    @Test
    @DisplayName("GET /dashboard without year/month defaults to the current period")
    void dashboardDefaultsToCurrentPeriod() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        LocalDate now = LocalDate.now();
        when(analyticsService.getDashboard(userId, now.getYear(), now.getMonthValue()))
                .thenReturn(DashboardResponse.builder().build());

        mockMvc.perform(get("/api/v1/analytics/dashboard"))
                .andExpect(status().isOk());

        verify(analyticsService).getDashboard(userId, now.getYear(), now.getMonthValue());
    }

    @Test
    @DisplayName("GET /dashboard with explicit year/month passes them through unchanged")
    void dashboardPassesExplicitPeriodThrough() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(analyticsService.getDashboard(userId, 2025, 3)).thenReturn(DashboardResponse.builder().build());

        mockMvc.perform(get("/api/v1/analytics/dashboard").param("year", "2025").param("month", "3"))
                .andExpect(status().isOk());

        verify(analyticsService).getDashboard(userId, 2025, 3);
    }

    @Test
    @DisplayName("GET /annual without a year param defaults to the current year")
    void annualDefaultsToCurrentYear() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        int currentYear = LocalDate.now().getYear();
        when(analyticsService.getAnnualTrend(userId, currentYear)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/analytics/annual"))
                .andExpect(status().isOk());

        verify(analyticsService).getAnnualTrend(userId, currentYear);
    }
}
