package com.wealthynest.domain.notification.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.notification.dto.request.UpdateNotificationPreferenceRequest;
import com.wealthynest.domain.notification.dto.response.NotificationPreferenceResponse;
import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import com.wealthynest.domain.notification.entity.DeviceToken;
import com.wealthynest.domain.notification.entity.Notification;
import com.wealthynest.domain.notification.entity.NotificationPreference;
import com.wealthynest.domain.notification.repository.DeviceTokenRepository;
import com.wealthynest.domain.notification.repository.NotificationPreferenceRepository;
import com.wealthynest.domain.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final PushNotificationSender pushNotificationSender;

    @Override @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(n -> NotificationResponse.builder()
                        .id(n.getId()).type(n.getType()).title(n.getTitle())
                        .message(n.getMessage()).read(n.isRead()).createdAt(n.getCreatedAt())
                        .build());
    }

    @Override @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Override @Transactional
    public void markAllRead(UUID userId) {
        notificationRepository.markAllReadByUserId(userId);
    }

    @Override @Transactional
    public void markRead(UUID userId, UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", id));
        if (!notification.getUserId().equals(userId)) throw new AccessDeniedException();
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Override @Transactional
    public void delete(UUID userId, UUID id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", "id", id));
        if (!notification.getUserId().equals(userId)) throw new AccessDeniedException();
        notificationRepository.delete(notification);
    }

    @Override @Transactional(readOnly = true)
    public NotificationPreferenceResponse getPreferences(UUID userId) {
        return toPreferenceResponse(notificationPreferenceRepository.findById(userId)
                .orElseGet(() -> NotificationPreference.builder().userId(userId).build()));
    }

    @Override @Transactional
    public NotificationPreferenceResponse updatePreferences(UUID userId, UpdateNotificationPreferenceRequest request) {
        NotificationPreference prefs = notificationPreferenceRepository.findById(userId)
                .orElseGet(() -> NotificationPreference.builder().userId(userId).build());
        prefs.setBudgetAlertEnabled(request.getBudgetAlertEnabled());
        prefs.setLowBalanceEnabled(request.getLowBalanceEnabled());
        prefs.setSpendAnomalyEnabled(request.getSpendAnomalyEnabled());
        prefs.setDebtDueEnabled(request.getDebtDueEnabled());
        prefs.setLoanEmiEnabled(request.getLoanEmiEnabled());
        prefs.setSipReminderEnabled(request.getSipReminderEnabled());
        return toPreferenceResponse(notificationPreferenceRepository.save(prefs));
    }

    @Override @Transactional
    public void registerDeviceToken(UUID userId, String token) {
        DeviceToken deviceToken = deviceTokenRepository.findByToken(token)
                .orElseGet(() -> DeviceToken.builder().userId(userId).token(token).build());
        deviceToken.setUserId(userId);
        deviceToken.setLastSeenAt(Instant.now());
        deviceTokenRepository.save(deviceToken);
    }

    @Override @Transactional
    public void unregisterDeviceToken(UUID userId, String token) {
        deviceTokenRepository.deleteByUserIdAndToken(userId, token);
    }

    private NotificationPreferenceResponse toPreferenceResponse(NotificationPreference p) {
        return NotificationPreferenceResponse.builder()
                .budgetAlertEnabled(p.isBudgetAlertEnabled())
                .lowBalanceEnabled(p.isLowBalanceEnabled())
                .spendAnomalyEnabled(p.isSpendAnomalyEnabled())
                .debtDueEnabled(p.isDebtDueEnabled())
                .loanEmiEnabled(p.isLoanEmiEnabled())
                .sipReminderEnabled(p.isSipReminderEnabled())
                .build();
    }

    /** Absence of a preference row means every alert type defaults to enabled. */
    private boolean isEnabled(UUID userId, java.util.function.Predicate<NotificationPreference> getter) {
        return notificationPreferenceRepository.findById(userId).map(getter::test).orElse(true);
    }

    @Override @Transactional
    public void createBudgetBreachNotification(UUID userId, String categoryName, String budgetType,
                                               BigDecimal spent, BigDecimal budget, double pct) {
        if (!isEnabled(userId, NotificationPreference::isBudgetAlertEnabled)) return;
        // A category can have both a MONTHLY and a YEARLY budget breached by the same expense —
        // the period must be part of the title, both so the two read as distinct alerts (not a
        // duplicate) and so the per-day dedup below doesn't collapse two real, different breaches
        // into one because their titles happened to collide.
        String period = "YEARLY".equals(budgetType) ? "Yearly" : "Monthly";
        String title = "Budget Alert: " + categoryName + " (" + period + ")";
        // Deduplicate — one alert per category+period per day
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "BUDGET_ALERT", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "You've used %.0f%% of your %s %s budget (spent ₹%.0f of ₹%.0f).",
            pct, categoryName, period.toLowerCase(), spent, budget);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("BUDGET_ALERT")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }

    @Override @Transactional
    public void createLowBalanceNotification(UUID userId, String accountName, BigDecimal balance, BigDecimal threshold) {
        if (!isEnabled(userId, NotificationPreference::isLowBalanceEnabled)) return;
        String title = "Low Balance: " + accountName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "LOW_BALANCE", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "%s has dropped to ₹%.0f, at or below your ₹%.0f alert threshold.",
            accountName, balance, threshold);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("LOW_BALANCE")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }

    @Override @Transactional
    public void createSpendAnomalyNotification(UUID userId, String categoryName, BigDecimal amount, BigDecimal average) {
        if (!isEnabled(userId, NotificationPreference::isSpendAnomalyEnabled)) return;
        String title = "Unusual Spend: " + categoryName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "SPEND_ANOMALY", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "A %s expense of ₹%.0f is well above your usual ₹%.0f for this category — check it's expected.",
            categoryName, amount, average);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("SPEND_ANOMALY")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }

    @Override @Transactional
    public void createDebtDueNotification(UUID userId, String contactName, BigDecimal amount, LocalDate dueDate, String debtType) {
        if (!isEnabled(userId, NotificationPreference::isDebtDueEnabled)) return;
        String title = "Debt Due: " + contactName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "DEBT_DUE", title, startOfDay);
        if (alreadySentToday) return;

        boolean isToday = dueDate.isEqual(LocalDate.now());
        String verb = "LENT".equals(debtType) ? "owes you" : "you owe";
        String message = isToday
            ? String.format("%s ₹%.0f — %s is due today.", contactName, amount, verb)
            : String.format("%s ₹%.0f — %s is due on %s.", contactName, amount, verb, dueDate);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("DEBT_DUE")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }

    @Override @Transactional
    public void createEmiUpcomingNotification(UUID userId, String loanName, BigDecimal amount, LocalDate dueDate) {
        if (!isEnabled(userId, NotificationPreference::isLoanEmiEnabled)) return;
        String title = "EMI Due Soon: " + loanName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "LOAN_EMI_UPCOMING", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "Your %s EMI of ₹%.0f will be auto-paid on %s.", loanName, amount, dueDate);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("LOAN_EMI_UPCOMING")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }

    @Override @Transactional
    public void createSipUpcomingNotification(UUID userId, String fundName, BigDecimal amount, LocalDate dueDate) {
        if (!isEnabled(userId, NotificationPreference::isSipReminderEnabled)) return;
        String title = "SIP Due Soon: " + fundName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "SIP_UPCOMING", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "Your %s SIP of ₹%.0f is due on %s.", fundName, amount, dueDate);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("SIP_UPCOMING")
                .title(title)
                .message(message)
                .build());
        pushNotificationSender.send(userId, title, message);
    }
}
