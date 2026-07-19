package com.wealthynest.domain.recurringtransfer.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.recurringtransfer.dto.request.CreateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.response.RecurringTransferResponse;
import com.wealthynest.domain.recurringtransfer.service.RecurringTransferService;
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

@WebMvcTest(controllers = RecurringTransferController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class RecurringTransferControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private RecurringTransferService service;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private CreateRecurringTransferRequest validRequest() {
        CreateRecurringTransferRequest req = new CreateRecurringTransferRequest();
        ReflectionTestUtils.setField(req, "fromAccountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "toAccountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("2000"));
        ReflectionTestUtils.setField(req, "dayOfMonth", 5);
        return req;
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/recurring-transfer"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(service);
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a missing toAccountId fails @NotNull validation")
        void missingToAccountIdFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringTransferRequest req = validRequest();
            ReflectionTestUtils.setField(req, "toAccountId", null);

            mockMvc.perform(post("/api/v1/recurring-transfer")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.toAccountId").exists());
        }

        @Test
        @DisplayName("a dayOfMonth above 31 fails @Max validation")
        void dayOfMonthAbove31FailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateRecurringTransferRequest req = validRequest();
            ReflectionTestUtils.setField(req, "dayOfMonth", 32);

            mockMvc.perform(post("/api/v1/recurring-transfer")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.dayOfMonth").exists());
        }
    }

    @Test
    @DisplayName("POST /recurring-transfer creates and returns 201")
    void createReturns201() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(service.create(eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(RecurringTransferResponse.builder().id(UUID.randomUUID()).build());

        mockMvc.perform(post("/api/v1/recurring-transfer")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRequest())))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("PATCH /{id}/toggle delegates the authenticated userId")
    void toggleDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        when(service.toggleActive(id, userId)).thenReturn(RecurringTransferResponse.builder().id(id).build());

        mockMvc.perform(patch("/api/v1/recurring-transfer/{id}/toggle", id))
                .andExpect(status().isOk());

        verify(service).toggleActive(id, userId);
    }

    @Test
    @DisplayName("GET /recurring-transfer delegates the authenticated userId and returns the service's list")
    void getAllDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(service.getAll(userId)).thenReturn(java.util.List.of(
                RecurringTransferResponse.builder().id(UUID.randomUUID()).build()));

        mockMvc.perform(get("/api/v1/recurring-transfer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("PUT /{id} passes the path id and authenticated userId through")
    void updateDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest req =
                new com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest();
        ReflectionTestUtils.setField(req, "amount", new BigDecimal("3000"));
        when(service.update(eq(id), eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(RecurringTransferResponse.builder().id(id).build());

        mockMvc.perform(put("/api/v1/recurring-transfer/{id}", id)
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

        mockMvc.perform(delete("/api/v1/recurring-transfer/{id}", id))
                .andExpect(status().isOk());

        verify(service).delete(id, userId);
    }
}
