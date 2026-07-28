package com.wealthynest.domain.networth.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import com.wealthynest.domain.networth.service.NetWorthService;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * NetWorthController.getHistory() maps NetWorthSnapshot entities to NetWorthHistoryPoint DTOs
 * directly in the controller (unusual — normally the service layer owns this), including the
 * "Jun 2026" label formatting — so that transformation only gets exercised by a controller-level
 * test, not by NetWorthServiceImplTest.
 */
@WebMvcTest(controllers = NetWorthController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class NetWorthControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private NetWorthService netWorthService;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/net-worth/summary"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(netWorthService);
    }

    @Test
    @DisplayName("GET /net-worth/summary passes the server-resolved familyId to the service")
    void summaryUsesServerResolvedFamilyId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(netWorthService.getSummary(userId, familyId)).thenReturn(
                NetWorthSummaryResponse.builder().totalNetWorth(new BigDecimal("50000")).build());

        mockMvc.perform(get("/api/v1/net-worth/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalNetWorth").value(50000));
    }

    @Test
    @DisplayName("GET /net-worth/history formats each snapshot's label as 'MMM yyyy'")
    void historyFormatsMonthLabel() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        NetWorthSnapshot snapshot = NetWorthSnapshot.builder()
                .id(UUID.randomUUID()).userId(userId).year(2026).month(6).netWorth(new BigDecimal("75000")).build();
        when(netWorthService.getHistory(userId)).thenReturn(List.of(snapshot));

        mockMvc.perform(get("/api/v1/net-worth/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].label").value("Jun 2026"))
                .andExpect(jsonPath("$.data[0].netWorth").value(75000));
    }
}
