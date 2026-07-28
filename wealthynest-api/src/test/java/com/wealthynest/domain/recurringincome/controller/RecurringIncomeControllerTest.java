package com.wealthynest.domain.recurringincome.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.recurringincome.dto.request.CreateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.response.RecurringIncomeResponse;
import com.wealthynest.domain.recurringincome.service.RecurringIncomeService;
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

@WebMvcTest(controllers = RecurringIncomeController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class RecurringIncomeControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private RecurringIncomeService service;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateRecurringIncomeRequest validRequest() {
        CreateRecurringIncomeRequest req = new CreateRecurringIncomeRequest();
        ReflectionTestUtils.setField(req, "accountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "source", "Salary");
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("50000"));
        ReflectionTestUtils.setField(req, "dayOfMonth", 1);
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/recurring-income"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(service);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a blank source fails @NotBlank validation")
        void blankSourceFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringIncomeRequest req = validRequest();
            ReflectionTestUtils.setField(req, "source", "");

            mockMvc.perform(post("/api/v1/recurring-income")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.source").exists());
        }

        @Test
        @DisplayName("a missing accountId fails @NotNull validation")
        void missingAccountIdFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringIncomeRequest req = validRequest();
            ReflectionTestUtils.setField(req, "accountId", null);

            mockMvc.perform(post("/api/v1/recurring-income")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.accountId").exists());
        }
    }

    @Test
    @DisplayName("POST /recurring-income creates and returns 201")
    void createReturns201() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(service.create(eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(RecurringIncomeResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/recurring-income")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("DELETE /recurring-income/{id} delegates the authenticated userId")
    void deleteDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/recurring-income/{id}", id))
                .andExpect(status().isOk());

        verify(service).delete(id, userId);
    }

    @Test
    @DisplayName("GET /recurring-income delegates the authenticated userId and returns the service's list")
    void getAllDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(service.getAll(userId)).thenReturn(java.util.List.of(
                RecurringIncomeResponse.builder().id(UUID.randomUUID()).build()));

        mockMvc.perform(get("/api/v1/recurring-income"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("PUT /recurring-income/{id} passes the path id and authenticated userId through")
    void updateDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest req =
                new com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest();
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("60000"));
        when(service.update(eq(id), eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(RecurringIncomeResponse.builder().id(id).build());

        mockMvc.perform(put("/api/v1/recurring-income/{id}", id)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }

    @Test
    @DisplayName("PATCH /recurring-income/{id}/toggle delegates the path id and authenticated userId")
    void toggleDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        when(service.toggleActive(id, userId)).thenReturn(RecurringIncomeResponse.builder().id(id).build());

        mockMvc.perform(patch("/api/v1/recurring-income/{id}/toggle", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
    }
}
