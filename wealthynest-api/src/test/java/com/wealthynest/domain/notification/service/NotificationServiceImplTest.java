package com.wealthynest.domain.notification.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.notification.dto.request.UpdateNotificationPreferenceRequest;
import com.wealthynest.domain.notification.entity.DeviceToken;
import com.wealthynest.domain.notification.entity.Notification;
import com.wealthynest.domain.notification.entity.NotificationPreference;
import com.wealthynest.domain.notification.repository.DeviceTokenRepository;
import com.wealthynest.domain.notification.repository.NotificationPreferenceRepository;
import com.wealthynest.domain.notification.repository.NotificationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationPreferenceRepository notificationPreferenceRepository;
    @Mock private DeviceTokenRepository deviceTokenRepository;
    @Mock private PushNotificationSender pushNotificationSender;

    @InjectMocks
    private NotificationServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final Pageable pageable = PageRequest.of(0, 20);

    private Notification notification(UUID owner) {
        return Notification.builder().id(UUID.randomUUID()).userId(owner)
                .type("BUDGET_ALERT").title("t").message("m").build();
    }

    // ─── dedup: shared across every create*Notification method ──────────────────

    @Nested
    @DisplayName("per-day dedup (one alert per type+title per day)")
    class DedupTests {

        @Test
        @DisplayName("budget breach: skips saving when the same alert already fired today")
        void budgetBreachSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("BUDGET_ALERT"), any(), any())).thenReturn(true);

            service.createBudgetBreachNotification(userId, "Groceries", "MONTHLY", new BigDecimal("900"), new BigDecimal("1000"), 90.0);

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("low balance: skips saving when the same alert already fired today")
        void lowBalanceSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("LOW_BALANCE"), any(), any())).thenReturn(true);

            service.createLowBalanceNotification(userId, "HDFC Savings", new BigDecimal("50"), new BigDecimal("500"));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("spend anomaly: skips saving when the same alert already fired today")
        void spendAnomalySkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("SPEND_ANOMALY"), any(), any())).thenReturn(true);

            service.createSpendAnomalyNotification(userId, "Dining", new BigDecimal("5000"), new BigDecimal("1000"));

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("debt due: skips saving when the same alert already fired today")
        void debtDueSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("DEBT_DUE"), any(), any())).thenReturn(true);

            service.createDebtDueNotification(userId, "Alice", new BigDecimal("500"), LocalDate.now(), "LENT");

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("EMI upcoming: skips saving when the same alert already fired today")
        void emiUpcomingSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("LOAN_EMI_UPCOMING"), any(), any())).thenReturn(true);

            service.createEmiUpcomingNotification(userId, "Car Loan", new BigDecimal("15000"), LocalDate.now().plusDays(3));

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("SIP upcoming: skips saving when the same alert already fired today")
        void sipUpcomingSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("SIP_UPCOMING"), any(), any())).thenReturn(true);

            service.createSipUpcomingNotification(userId, "Axis Bluechip Fund", new BigDecimal("5000"), LocalDate.now().plusDays(2));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }
    }

    // ─── content correctness ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("notification content")
    class ContentTests {

        @Test
        @DisplayName("budget breach message reports the percentage, both amounts, and the budget period")
        void budgetBreachMessageContent() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);

            service.createBudgetBreachNotification(userId, "Groceries", "MONTHLY", new BigDecimal("900"), new BigDecimal("1000"), 90.0);

            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getType()).isEqualTo("BUDGET_ALERT");
            assertThat(captor.getValue().getTitle()).isEqualTo("Budget Alert: Groceries (Monthly)");
            assertThat(captor.getValue().getMessage()).contains("90%").contains("900").contains("1000").contains("monthly");
            verify(pushNotificationSender).send(userId, captor.getValue().getTitle(), captor.getValue().getMessage());
        }

        @Test
        @DisplayName("budget breach title differs by period, so a MONTHLY and YEARLY breach on the same category+day are distinct, not deduped away")
        void budgetBreachTitleDiffersByPeriod() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> monthlyCaptor = ArgumentCaptor.forClass(Notification.class);
            service.createBudgetBreachNotification(userId, "Groceries", "MONTHLY", new BigDecimal("900"), new BigDecimal("1000"), 90.0);
            verify(notificationRepository).save(monthlyCaptor.capture());

            reset(notificationRepository);
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> yearlyCaptor = ArgumentCaptor.forClass(Notification.class);
            service.createBudgetBreachNotification(userId, "Groceries", "YEARLY", new BigDecimal("9000"), new BigDecimal("10000"), 90.0);
            verify(notificationRepository).save(yearlyCaptor.capture());

            assertThat(monthlyCaptor.getValue().getTitle()).isEqualTo("Budget Alert: Groceries (Monthly)");
            assertThat(yearlyCaptor.getValue().getTitle()).isEqualTo("Budget Alert: Groceries (Yearly)");
            assertThat(monthlyCaptor.getValue().getTitle()).isNotEqualTo(yearlyCaptor.getValue().getTitle());
        }

        @Test
        @DisplayName("SIP upcoming message reports the fund name, amount, and due date")
        void sipUpcomingMessageContent() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
            LocalDate dueDate = LocalDate.now().plusDays(2);

            service.createSipUpcomingNotification(userId, "Axis Bluechip Fund", new BigDecimal("5000"), dueDate);

            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getType()).isEqualTo("SIP_UPCOMING");
            assertThat(captor.getValue().getTitle()).isEqualTo("SIP Due Soon: Axis Bluechip Fund");
            assertThat(captor.getValue().getMessage()).contains("5000").contains(dueDate.toString());
            verify(pushNotificationSender).send(userId, captor.getValue().getTitle(), captor.getValue().getMessage());
        }

        @Test
        @DisplayName("debt due 'today' uses present-tense phrasing instead of a future date")
        void debtDueTodayUsesPresentTense() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);

            service.createDebtDueNotification(userId, "Alice", new BigDecimal("500"), LocalDate.now(), "LENT");

            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getMessage()).contains("due today").doesNotContain("due on");
        }

        @Test
        @DisplayName("debt due on a future date includes that date, not 'today'")
        void debtDueFutureDateIncludesDate() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            LocalDate future = LocalDate.now().plusDays(5);
            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);

            service.createDebtDueNotification(userId, "Bob", new BigDecimal("500"), future, "BORROWED");

            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getMessage()).contains("due on " + future);
        }

        @Test
        @DisplayName("debt due verb differs for LENT ('owes you') vs BORROWED ('you owe')")
        void debtDueVerbDiffersByType() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> lentCaptor = ArgumentCaptor.forClass(Notification.class);
            service.createDebtDueNotification(userId, "Alice", new BigDecimal("500"), LocalDate.now(), "LENT");
            verify(notificationRepository).save(lentCaptor.capture());
            assertThat(lentCaptor.getValue().getMessage()).contains("owes you");

            reset(notificationRepository);
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> borrowedCaptor = ArgumentCaptor.forClass(Notification.class);
            service.createDebtDueNotification(userId, "Bob", new BigDecimal("500"), LocalDate.now(), "BORROWED");
            verify(notificationRepository).save(borrowedCaptor.capture());
            assertThat(borrowedCaptor.getValue().getMessage()).contains("you owe");
        }
    }

    // ─── per-notification mark-read / delete (ownership-checked) ────────────────

    @Nested
    @DisplayName("markRead / delete: ownership checks")
    class OwnershipTests {

        @Test
        @DisplayName("markRead flips read to true and saves when the notification belongs to the caller")
        void markReadSetsReadWhenOwned() {
            Notification n = notification(userId);
            when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));

            service.markRead(userId, n.getId());

            assertThat(n.isRead()).isTrue();
            verify(notificationRepository).save(n);
        }

        @Test
        @DisplayName("markRead throws ResourceNotFoundException when the id doesn't exist")
        void markReadThrowsWhenMissing() {
            UUID id = UUID.randomUUID();
            when(notificationRepository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.markRead(userId, id))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("markRead throws AccessDeniedException when the notification belongs to another user")
        void markReadThrowsWhenNotOwned() {
            Notification n = notification(UUID.randomUUID());
            when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));

            assertThatThrownBy(() -> service.markRead(userId, n.getId()))
                    .isInstanceOf(AccessDeniedException.class);
            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("delete removes the notification when it belongs to the caller")
        void deleteRemovesWhenOwned() {
            Notification n = notification(userId);
            when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));

            service.delete(userId, n.getId());

            verify(notificationRepository).delete(n);
        }

        @Test
        @DisplayName("delete throws AccessDeniedException when the notification belongs to another user")
        void deleteThrowsWhenNotOwned() {
            Notification n = notification(UUID.randomUUID());
            when(notificationRepository.findById(n.getId())).thenReturn(Optional.of(n));

            assertThatThrownBy(() -> service.delete(userId, n.getId()))
                    .isInstanceOf(AccessDeniedException.class);
            verify(notificationRepository, never()).delete(any());
        }

        @Test
        @DisplayName("delete throws ResourceNotFoundException when the id doesn't exist")
        void deleteThrowsWhenMissing() {
            UUID id = UUID.randomUUID();
            when(notificationRepository.findById(id)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(userId, id))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ─── preferences ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("preferences")
    class PreferenceTests {

        @Test
        @DisplayName("getPreferences defaults every type to enabled when no row exists yet")
        void getPreferencesDefaultsToEnabled() {
            when(notificationPreferenceRepository.findById(userId)).thenReturn(Optional.empty());

            var result = service.getPreferences(userId);

            assertThat(result.isBudgetAlertEnabled()).isTrue();
            assertThat(result.isLowBalanceEnabled()).isTrue();
            assertThat(result.isSpendAnomalyEnabled()).isTrue();
            assertThat(result.isDebtDueEnabled()).isTrue();
            assertThat(result.isLoanEmiEnabled()).isTrue();
        }

        @Test
        @DisplayName("updatePreferences persists all six flags and returns the saved state")
        void updatePreferencesPersistsAllFlags() {
            when(notificationPreferenceRepository.findById(userId)).thenReturn(Optional.empty());
            when(notificationPreferenceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UpdateNotificationPreferenceRequest req = new UpdateNotificationPreferenceRequest();
            req.setBudgetAlertEnabled(false);
            req.setLowBalanceEnabled(false);
            req.setSpendAnomalyEnabled(true);
            req.setDebtDueEnabled(false);
            req.setLoanEmiEnabled(true);
            req.setSipReminderEnabled(false);

            var result = service.updatePreferences(userId, req);

            assertThat(result.isBudgetAlertEnabled()).isFalse();
            assertThat(result.isLowBalanceEnabled()).isFalse();
            assertThat(result.isSpendAnomalyEnabled()).isTrue();
            assertThat(result.isDebtDueEnabled()).isFalse();
            assertThat(result.isLoanEmiEnabled()).isTrue();
            assertThat(result.isSipReminderEnabled()).isFalse();

            ArgumentCaptor<NotificationPreference> captor = ArgumentCaptor.forClass(NotificationPreference.class);
            verify(notificationPreferenceRepository).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        }
    }

    // ─── preference gating: disabled type skips saving even when dedup would allow it ────

    @Nested
    @DisplayName("preference gating")
    class PreferenceGatingTests {

        @Test
        @DisplayName("budget breach is skipped when budget alerts are disabled")
        void budgetBreachSkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).budgetAlertEnabled(false).build()));

            service.createBudgetBreachNotification(userId, "Groceries", "MONTHLY", new BigDecimal("900"), new BigDecimal("1000"), 90.0);

            verify(notificationRepository, never()).save(any());
            verify(notificationRepository, never()).existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("low balance is skipped when low-balance alerts are disabled")
        void lowBalanceSkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).lowBalanceEnabled(false).build()));

            service.createLowBalanceNotification(userId, "HDFC Savings", new BigDecimal("50"), new BigDecimal("500"));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("spend anomaly is skipped when spend-anomaly alerts are disabled")
        void spendAnomalySkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).spendAnomalyEnabled(false).build()));

            service.createSpendAnomalyNotification(userId, "Dining", new BigDecimal("5000"), new BigDecimal("1000"));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("debt due is skipped when debt-due alerts are disabled")
        void debtDueSkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).debtDueEnabled(false).build()));

            service.createDebtDueNotification(userId, "Alice", new BigDecimal("500"), LocalDate.now(), "LENT");

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("EMI upcoming is skipped when loan-EMI alerts are disabled")
        void emiUpcomingSkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).loanEmiEnabled(false).build()));

            service.createEmiUpcomingNotification(userId, "Car Loan", new BigDecimal("15000"), LocalDate.now().plusDays(3));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }

        @Test
        @DisplayName("SIP upcoming is skipped when SIP-reminder alerts are disabled")
        void sipUpcomingSkippedWhenDisabled() {
            when(notificationPreferenceRepository.findById(userId))
                    .thenReturn(Optional.of(NotificationPreference.builder().userId(userId).sipReminderEnabled(false).build()));

            service.createSipUpcomingNotification(userId, "Axis Bluechip Fund", new BigDecimal("5000"), LocalDate.now().plusDays(2));

            verify(notificationRepository, never()).save(any());
            verify(pushNotificationSender, never()).send(any(), any(), any());
        }
    }

    // ─── device tokens (push registration) ───────────────────────────────────────

    @Nested
    @DisplayName("device tokens")
    class DeviceTokenTests {

        @Test
        @DisplayName("registerDeviceToken saves a new token against the calling user")
        void registerDeviceTokenSavesNewToken() {
            when(deviceTokenRepository.findByToken("tok-1")).thenReturn(Optional.empty());
            ArgumentCaptor<DeviceToken> captor = ArgumentCaptor.forClass(DeviceToken.class);

            service.registerDeviceToken(userId, "tok-1");

            verify(deviceTokenRepository).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
            assertThat(captor.getValue().getToken()).isEqualTo("tok-1");
        }

        @Test
        @DisplayName("registerDeviceToken re-owns an existing token and bumps lastSeenAt instead of duplicating it")
        void registerDeviceTokenReownsExistingToken() {
            UUID otherUser = UUID.randomUUID();
            DeviceToken existing = DeviceToken.builder().id(UUID.randomUUID()).userId(otherUser).token("tok-1").build();
            when(deviceTokenRepository.findByToken("tok-1")).thenReturn(Optional.of(existing));
            ArgumentCaptor<DeviceToken> captor = ArgumentCaptor.forClass(DeviceToken.class);

            service.registerDeviceToken(userId, "tok-1");

            verify(deviceTokenRepository).save(captor.capture());
            assertThat(captor.getValue().getId()).isEqualTo(existing.getId());
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        }

        @Test
        @DisplayName("unregisterDeviceToken deletes by token")
        void unregisterDeviceTokenDeletesByToken() {
            service.unregisterDeviceToken("tok-1");

            verify(deviceTokenRepository).deleteByToken("tok-1");
        }
    }

    // ─── simple delegation ───────────────────────────────────────────────────────

    @Test
    @DisplayName("getUnreadCount and markAllRead delegate directly to the repository")
    void simpleDelegation() {
        when(notificationRepository.countByUserIdAndReadFalse(userId)).thenReturn(3L);
        assertThat(service.getUnreadCount(userId)).isEqualTo(3L);

        service.markAllRead(userId);
        verify(notificationRepository).markAllReadByUserId(userId);
    }
}
