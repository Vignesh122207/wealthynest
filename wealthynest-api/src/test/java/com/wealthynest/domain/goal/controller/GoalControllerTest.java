package com.wealthynest.domain.goal.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.goal.dto.request.CreateGoalRequest;
import com.wealthynest.domain.goal.dto.response.GoalResponse;
import com.wealthynest.domain.goal.service.GoalService;
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

@WebMvcTest(controllers = GoalController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class GoalControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private GoalService goalService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateGoalRequest validRequest() {
        CreateGoalRequest req = new CreateGoalRequest();
        ReflectionTestUtils.setField(req, "name", "Emergency Fund");
        ReflectionTestUtils.setField(req, "targetAmount", new BigDecimal("100000"));
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/goals"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(goalService);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a blank name fails @NotBlank validation")
        void blankNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateGoalRequest req = validRequest();
            ReflectionTestUtils.setField(req, "name", "");

            mockMvc.perform(post("/api/v1/goals")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.name").exists());
        }

        @Test
        @DisplayName("a zero targetAmount fails @Positive validation")
        void zeroTargetAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateGoalRequest req = validRequest();
            ReflectionTestUtils.setField(req, "targetAmount", BigDecimal.ZERO);

            mockMvc.perform(post("/api/v1/goals")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.targetAmount").exists());
        }

        @Test
        @DisplayName("a negative savedAmount fails @PositiveOrZero validation")
        void negativeSavedAmountFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateGoalRequest req = validRequest();
            ReflectionTestUtils.setField(req, "savedAmount", new BigDecimal("-1"));

            mockMvc.perform(post("/api/v1/goals")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.savedAmount").exists());
        }
    }

    @Nested
    @DisplayName("happy-path delegation")
    class DelegationTests {

        @Test
        @DisplayName("POST /goals creates and returns 201 with the created goal")
        void createReturns201() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(goalService.create(eq(userId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                    .thenReturn(GoalResponse.builder().id(UUID.randomUUID()).name("Emergency Fund").build());

            mockMvc.perform(post("/api/v1/goals")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRequest())))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.data.name").value("Emergency Fund"));
        }

        @Test
        @DisplayName("DELETE /goals/{id} delegates the authenticated userId")
        void deleteDelegatesUserId() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID goalId = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/goals/{id}", goalId))
                    .andExpect(status().isOk());

            verify(goalService).delete(goalId, userId, null);
        }
    }
}
