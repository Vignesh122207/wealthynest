package com.wealthynest.domain.expensesplit.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.expensesplit.dto.response.MySplitsResponse;
import com.wealthynest.domain.expensesplit.service.ExpenseSplitService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ExpenseSplitController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class ExpenseSplitControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private ExpenseSplitService expenseSplitService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/expense-splits/my-splits"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(expenseSplitService);
    }

    @Test
    @DisplayName("GET /my-splits returns the authenticated user's splits")
    void mySplitsDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(expenseSplitService.getMySplits(userId)).thenReturn(
                MySplitsResponse.builder().balances(List.of()).pending(List.of()).build());

        mockMvc.perform(get("/api/v1/expense-splits/my-splits"))
                .andExpect(status().isOk());

        verify(expenseSplitService).getMySplits(userId);
    }

    @Test
    @DisplayName("POST /{id}/settle delegates the authenticated userId")
    void settleDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID splitId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/expense-splits/{id}/settle", splitId))
                .andExpect(status().isOk());

        verify(expenseSplitService).settleSplit(splitId, userId);
    }

    @Test
    @DisplayName("POST /settle-with/{counterpartId} delegates both the authenticated userId and the counterpart")
    void settleWithDelegatesBothIds() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID counterpartId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/expense-splits/settle-with/{counterpartId}", counterpartId))
                .andExpect(status().isOk());

        verify(expenseSplitService).settleWithCounterpart(userId, counterpartId);
    }
}
