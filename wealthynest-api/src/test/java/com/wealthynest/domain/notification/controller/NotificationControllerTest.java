package com.wealthynest.domain.notification.controller;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.notification.dto.response.NotificationPreferenceResponse;
import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import com.wealthynest.domain.notification.service.NotificationService;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = NotificationController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class NotificationControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private NotificationService notificationService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(notificationService);
    }

    @Test
    @DisplayName("GET /notifications returns a paged response for the authenticated user")
    void getAllReturnsPagedResponse() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        Page<NotificationResponse> page = new PageImpl<>(List.of(NotificationResponse.builder().id(UUID.randomUUID()).build()),
                Pageable.ofSize(20), 1);
        when(notificationService.getNotifications(org.mockito.ArgumentMatchers.eq(userId), any())).thenReturn(page);

        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    @DisplayName("GET /notifications/unread-count returns the authenticated user's count")
    void getUnreadCountReturnsValue() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(notificationService.getUnreadCount(userId)).thenReturn(3L);

        mockMvc.perform(get("/api/v1/notifications/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(3));
    }

    @Test
    @DisplayName("POST /notifications/mark-all-read delegates the authenticated userId")
    void markAllReadDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(post("/api/v1/notifications/mark-all-read"))
                .andExpect(status().isOk());

        verify(notificationService).markAllRead(userId);
    }

    @Test
    @DisplayName("POST /notifications/{id}/read delegates the authenticated userId and notification id")
    void markReadDelegatesUserIdAndId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/notifications/" + id + "/read"))
                .andExpect(status().isOk());

        verify(notificationService).markRead(userId, id);
    }

    @Test
    @DisplayName("POST /notifications/{id}/read returns 404 when the notification doesn't exist")
    void markReadReturns404WhenMissing() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Notification", "id", id)).when(notificationService).markRead(userId, id);

        mockMvc.perform(post("/api/v1/notifications/" + id + "/read"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("POST /notifications/{id}/read returns 403 when the notification belongs to another user")
    void markReadReturns403WhenNotOwned() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        doThrow(new AccessDeniedException()).when(notificationService).markRead(userId, id);

        mockMvc.perform(post("/api/v1/notifications/" + id + "/read"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("DELETE /notifications/{id} delegates the authenticated userId and notification id")
    void deleteDelegatesUserIdAndId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/notifications/" + id))
                .andExpect(status().isOk());

        verify(notificationService).delete(userId, id);
    }

    @Test
    @DisplayName("DELETE /notifications/{id} returns 403 when the notification belongs to another user")
    void deleteReturns403WhenNotOwned() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UUID id = UUID.randomUUID();
        doThrow(new AccessDeniedException()).when(notificationService).delete(userId, id);

        mockMvc.perform(delete("/api/v1/notifications/" + id))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /notifications/preferences returns the authenticated user's preferences")
    void getPreferencesReturnsValue() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(notificationService.getPreferences(userId)).thenReturn(NotificationPreferenceResponse.builder()
                .budgetAlertEnabled(true).lowBalanceEnabled(false).spendAnomalyEnabled(true)
                .debtDueEnabled(true).loanEmiEnabled(false).build());

        mockMvc.perform(get("/api/v1/notifications/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.budgetAlertEnabled").value(true))
                .andExpect(jsonPath("$.data.lowBalanceEnabled").value(false));
    }

    @Test
    @DisplayName("PUT /notifications/preferences delegates the authenticated userId and request body")
    void updatePreferencesDelegatesUserIdAndBody() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(notificationService.updatePreferences(eq(userId), any())).thenReturn(NotificationPreferenceResponse.builder()
                .budgetAlertEnabled(false).lowBalanceEnabled(true).spendAnomalyEnabled(true)
                .debtDueEnabled(true).loanEmiEnabled(true).build());

        mockMvc.perform(put("/api/v1/notifications/preferences")
                        .contentType("application/json")
                        .content("""
                                {"budgetAlertEnabled":false,"lowBalanceEnabled":true,"spendAnomalyEnabled":true,"debtDueEnabled":true,"loanEmiEnabled":true}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.budgetAlertEnabled").value(false));

        verify(notificationService).updatePreferences(eq(userId), any());
    }

    @Test
    @DisplayName("PUT /notifications/preferences rejects a body missing a required flag")
    void updatePreferencesRejectsMissingFlag() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(put("/api/v1/notifications/preferences")
                        .contentType("application/json")
                        .content("""
                                {"lowBalanceEnabled":true,"spendAnomalyEnabled":true,"debtDueEnabled":true,"loanEmiEnabled":true}"""))
                .andExpect(status().isUnprocessableEntity());
    }
}
