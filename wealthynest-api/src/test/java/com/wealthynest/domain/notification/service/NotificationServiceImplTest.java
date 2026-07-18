package com.wealthynest.domain.notification.service;

import com.wealthynest.domain.notification.entity.Notification;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceImplTest {

    @Mock private NotificationRepository notificationRepository;

    @InjectMocks
    private NotificationServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final Pageable pageable = PageRequest.of(0, 20);

    // ─── dedup: shared across every create*Notification method ──────────────────

    @Nested
    @DisplayName("per-day dedup (one alert per type+title per day)")
    class DedupTests {

        @Test
        @DisplayName("budget breach: skips saving when the same alert already fired today")
        void budgetBreachSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("BUDGET_ALERT"), any(), any())).thenReturn(true);

            service.createBudgetBreachNotification(userId, "Groceries", new BigDecimal("900"), new BigDecimal("1000"), 90.0);

            verify(notificationRepository, never()).save(any());
        }

        @Test
        @DisplayName("low balance: skips saving when the same alert already fired today")
        void lowBalanceSkipsWhenAlreadySentToday() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(
                    eq(userId), eq("LOW_BALANCE"), any(), any())).thenReturn(true);

            service.createLowBalanceNotification(userId, "HDFC Savings", new BigDecimal("50"), new BigDecimal("500"));

            verify(notificationRepository, never()).save(any());
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
    }

    // ─── content correctness ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("notification content")
    class ContentTests {

        @Test
        @DisplayName("budget breach message reports the percentage and both amounts")
        void budgetBreachMessageContent() {
            when(notificationRepository.existsByUserIdAndTypeAndTitleAndCreatedAtAfter(any(), any(), any(), any())).thenReturn(false);
            ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);

            service.createBudgetBreachNotification(userId, "Groceries", new BigDecimal("900"), new BigDecimal("1000"), 90.0);

            verify(notificationRepository).save(captor.capture());
            assertThat(captor.getValue().getType()).isEqualTo("BUDGET_ALERT");
            assertThat(captor.getValue().getTitle()).isEqualTo("Budget Alert: Groceries");
            assertThat(captor.getValue().getMessage()).contains("90%").contains("900").contains("1000");
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
