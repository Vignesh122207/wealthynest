package com.wealthynest.domain.notification.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
}
