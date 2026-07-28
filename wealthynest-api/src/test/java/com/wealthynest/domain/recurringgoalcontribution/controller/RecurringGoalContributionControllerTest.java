package com.wealthynest.domain.recurringgoalcontribution.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.CreateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.response.RecurringGoalContributionResponse;
import com.wealthynest.domain.recurringgoalcontribution.service.RecurringGoalContributionService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = RecurringGoalContributionController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class RecurringGoalContributionControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private RecurringGoalContributionService service;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateRecurringGoalContributionRequest validRequest() {
        CreateRecurringGoalContributionRequest req = new CreateRecurringGoalContributionRequest();
        ReflectionTestUtils.setField(req, "goalId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("1000"));
        ReflectionTestUtils.setField(req, "dayOfMonth", 1);
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/recurring-goal-contribution"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(service);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a dayOfMonth above 31 fails @Max validation")
        void dayOfMonthAbove31FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringGoalContributionRequest req = validRequest();
            ReflectionTestUtils.setField(req, "dayOfMonth", 32);

            mockMvc.perform(post("/api/v1/recurring-goal-contribution")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.dayOfMonth").exists());
        }

        @Test
        @DisplayName("dayOfMonth=0 (last working day) is valid, not rejected by @Min")
        void dayOfMonthZeroIsValid() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringGoalContributionRequest req = validRequest();
            ReflectionTestUtils.setField(req, "dayOfMonth", 0);
            when(service.create(eq(userId), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(RecurringGoalContributionResponse.builder().id(UUID.randomUUID()).build());

            mockMvc.perform(post("/api/v1/recurring-goal-contribution")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated());
        }
    }

    @Test
    @DisplayName("PATCH /{id}/toggle delegates the authenticated userId")
    void toggleDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        when(service.toggleActive(id, userId)).thenReturn(RecurringGoalContributionResponse.builder().id(id).build());

        mockMvc.perform(patch("/api/v1/recurring-goal-contribution/{id}/toggle", id))
                .andExpect(status().isOk());

        verify(service).toggleActive(id, userId);
    }

    @Test
    @DisplayName("GET /recurring-goal-contribution delegates the authenticated userId and returns the service's list")
    void getAllDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(service.getAll(userId)).thenReturn(java.util.List.of(
                RecurringGoalContributionResponse.builder().id(UUID.randomUUID()).build()));

        mockMvc.perform(get("/api/v1/recurring-goal-contribution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("PUT /{id} passes the path id and authenticated userId through")
    void updateDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest req =
                new com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest();
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("2000"));
        when(service.update(eq(id), eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(RecurringGoalContributionResponse.builder().id(id).build());

        mockMvc.perform(put("/api/v1/recurring-goal-contribution/{id}", id)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    @DisplayName("DELETE /{id} delegates the authenticated userId")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/recurring-goal-contribution/{id}", id))
                .andExpect(status().isOk());

        verify(service).delete(id, userId);
    }
}
