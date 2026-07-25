package com.wealthynest.domain.notification.service;

import com.wealthynest.domain.notification.dto.request.UpdateNotificationPreferenceRequest;
import com.wealthynest.domain.notification.dto.response.NotificationPreferenceResponse;
import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public interface NotificationService {
    Page<NotificationResponse> getNotifications(UUID userId, Pageable pageable);
    long getUnreadCount(UUID userId);
    void markAllRead(UUID userId);
    void markRead(UUID userId, UUID id);
    void delete(UUID userId, UUID id);
    NotificationPreferenceResponse getPreferences(UUID userId);
    NotificationPreferenceResponse updatePreferences(UUID userId, UpdateNotificationPreferenceRequest request);
    void createBudgetBreachNotification(UUID userId, String categoryName, BigDecimal spent, BigDecimal budget, double pct);
    void createLowBalanceNotification(UUID userId, String accountName, BigDecimal balance, BigDecimal threshold);
    void createSpendAnomalyNotification(UUID userId, String categoryName, BigDecimal amount, BigDecimal average);
    void createDebtDueNotification(UUID userId, String contactName, BigDecimal amount, LocalDate dueDate, String debtType);
    void createEmiUpcomingNotification(UUID userId, String loanName, BigDecimal amount, LocalDate dueDate);
}
