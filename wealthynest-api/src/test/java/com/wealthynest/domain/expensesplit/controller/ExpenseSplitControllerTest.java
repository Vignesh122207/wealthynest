package com.wealthynest.domain.expensesplit.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ExpenseSplitController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class ExpenseSplitControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
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

    @Test
    @DisplayName("GET /expense/{expenseId} delegates the authenticated userId")
    void getForExpenseDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID expenseId = UUID.randomUUID();
        when(expenseSplitService.getSplitsForExpense(expenseId, userId)).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/expense-splits/expense/{expenseId}", expenseId))
                .andExpect(status().isOk());

        verify(expenseSplitService).getSplitsForExpense(expenseId, userId);
    }

    @Test
    @DisplayName("POST /expense/{expenseId} delegates the authenticated userId and the split list")
    void addForExpenseDelegatesUserIdAndBody() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID expenseId = UUID.randomUUID();
        UUID friendId  = UUID.randomUUID();
        String body = objectMapper.writeValueAsString(Map.of(
                "splitWith", List.of(Map.of("userId", friendId.toString(), "shareAmount", new BigDecimal("25")))));

        mockMvc.perform(post("/api/v1/expense-splits/expense/{expenseId}", expenseId)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        verify(expenseSplitService).addSplits(org.mockito.ArgumentMatchers.eq(expenseId),
                org.mockito.ArgumentMatchers.eq(userId), any());
    }

    @Test
    @DisplayName("POST /expense/{expenseId} rejects an empty splitWith list before reaching the service")
    void addForExpenseRejectsEmptyList() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID expenseId = UUID.randomUUID();
        String body = objectMapper.writeValueAsString(Map.of("splitWith", List.of()));

        mockMvc.perform(post("/api/v1/expense-splits/expense/{expenseId}", expenseId)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnprocessableEntity());

        org.mockito.Mockito.verifyNoInteractions(expenseSplitService);
    }
}
