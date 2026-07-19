package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtStatus;
import com.wealthynest.domain.debt.entity.DebtType;
import com.wealthynest.domain.debt.repository.DebtRecordRepository;
import com.wealthynest.domain.notification.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DebtReminderSchedulerTest {

    @Mock private DebtRecordRepository debtRecordRepository;
    @Mock private NotificationService  notificationService;

    @InjectMocks
    private DebtReminderScheduler scheduler;

    private DebtRecord debt(LocalDate dueDate) {
        DebtRecord debt = DebtRecord.builder()
                .userId(UUID.randomUUID()).type(DebtType.BORROWED).contactName("Alex")
                .amount(new BigDecimal("2000")).status(DebtStatus.ACTIVE).dueDate(dueDate).build();
        ReflectionTestUtils.setField(debt, "id", UUID.randomUUID());
        return debt;
    }

    @Nested
    @DisplayName("checkUpcomingDueDates")
    class CheckUpcomingDueDatesTests {

        @Test
        @DisplayName("notifies when the debt is due exactly 3 days from today")
        void notifiesThreeDaysAhead() {
            LocalDate due = LocalDate.now().plusDays(3);
            DebtRecord debt = debt(due);
            when(debtRecordRepository.findByStatusAndDueDateIsNotNull(DebtStatus.ACTIVE)).thenReturn(List.of(debt));

            scheduler.checkUpcomingDueDates();

            verify(notificationService).createDebtDueNotification(
                    debt.getUserId(), "Alex", debt.getAmount(), due, "BORROWED");
        }

        @Test
        @DisplayName("notifies when the debt is due today")
        void notifiesOnDueDate() {
            LocalDate due = LocalDate.now();
            DebtRecord debt = debt(due);
            when(debtRecordRepository.findByStatusAndDueDateIsNotNull(DebtStatus.ACTIVE)).thenReturn(List.of(debt));

            scheduler.checkUpcomingDueDates();

            verify(notificationService).createDebtDueNotification(
                    debt.getUserId(), "Alex", debt.getAmount(), due, "BORROWED");
        }

        @Test
        @DisplayName("does not notify when the due date is neither today nor 3 days away")
        void skipsWhenNeitherTodayNorLookahead() {
            DebtRecord debt = debt(LocalDate.now().plusDays(10));
            when(debtRecordRepository.findByStatusAndDueDateIsNotNull(DebtStatus.ACTIVE)).thenReturn(List.of(debt));

            scheduler.checkUpcomingDueDates();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("continues processing remaining debts when one throws")
        void continuesAfterException() {
            LocalDate due = LocalDate.now();
            DebtRecord failing = debt(due);
            DebtRecord succeeding = debt(due);
            when(debtRecordRepository.findByStatusAndDueDateIsNotNull(DebtStatus.ACTIVE))
                    .thenReturn(List.of(failing, succeeding));
            doThrow(new RuntimeException("boom")).when(notificationService)
                    .createDebtDueNotification(eq(failing.getUserId()), any(), any(), any(), any());

            scheduler.checkUpcomingDueDates();

            verify(notificationService).createDebtDueNotification(
                    eq(succeeding.getUserId()), any(), any(), any(), any());
        }
    }
}
