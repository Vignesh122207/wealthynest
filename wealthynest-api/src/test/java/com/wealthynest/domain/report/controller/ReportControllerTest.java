package com.wealthynest.domain.report.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.report.dto.ReportCsv;
import com.wealthynest.domain.report.service.ReportService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ReportController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class ReportControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private ReportService reportService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/reports/monthly").param("year", "2026").param("month", "6"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(reportService);
    }

    @Test
    @DisplayName("GET /reports/monthly without required params returns 400 MISSING_PARAMETER")
    void monthlyWithoutParamsReturns400() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(get("/api/v1/reports/monthly"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /reports/monthly returns a CSV attachment with the service's filename")
    void monthlyReturnsCsvAttachment() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(reportService.generateMonthlyReport(userId, 2026, 6))
                .thenReturn(new ReportCsv("date,amount\n".getBytes(), "june-2026.csv"));

        mockMvc.perform(get("/api/v1/reports/monthly").param("year", "2026").param("month", "6"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andExpect(header().string("Content-Disposition", containsString("june-2026.csv")));
    }

    @Test
    @DisplayName("GET /reports/annual returns a CSV attachment with the service's filename")
    void annualReturnsCsvAttachment() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(reportService.generateAnnualReport(userId, 2026))
                .thenReturn(new ReportCsv("date,amount\n".getBytes(), "2026.csv"));

        mockMvc.perform(get("/api/v1/reports/annual").param("year", "2026"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("2026.csv")));
    }
}
