package com.wealthynest.infra.scheduler;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
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
class SipReminderSchedulerTest {

    @Mock private InvestmentRepository investmentRepository;
    @Mock private NotificationService  notificationService;

    @InjectMocks
    private SipReminderScheduler scheduler;

    private Investment mf(int sipDay) {
        Investment inv = Investment.builder()
                .userId(UUID.randomUUID())
                .investmentType(InvestmentType.MUTUAL_FUND).companyName("Axis Bluechip Fund")
                .investedAmount(BigDecimal.ZERO).currentValue(BigDecimal.ZERO)
                .sipAmount(new BigDecimal("5000")).sipDay(sipDay).build();
        ReflectionTestUtils.setField(inv, "id", UUID.randomUUID());
        return inv;
    }

    @Nested
    @DisplayName("checkUpcomingSips")
    class CheckUpcomingSipsTests {

        @Test
        @DisplayName("notifies when the next SIP date is exactly 2 days from today")
        void notifiesWhenTwoDaysAhead() {
            LocalDate target = LocalDate.now().plusDays(2);
            Investment inv = mf(target.getDayOfMonth());
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));

            scheduler.checkUpcomingSips();

            verify(notificationService).createSipUpcomingNotification(
                    inv.getUserId(), "Axis Bluechip Fund", inv.getSipAmount(), target);
        }

        @Test
        @DisplayName("does not notify when the next SIP date is not exactly 2 days away")
        void skipsWhenNotTwoDaysAhead() {
            LocalDate target = LocalDate.now().plusDays(5);
            Investment inv = mf(target.getDayOfMonth());
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));

            scheduler.checkUpcomingSips();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("skips a fund with no SIP day configured")
        void skipsUnconfiguredFund() {
            Investment inv = Investment.builder()
                    .userId(UUID.randomUUID())
                    .investmentType(InvestmentType.MUTUAL_FUND).companyName("Lump Sum Fund")
                    .investedAmount(BigDecimal.ZERO).currentValue(BigDecimal.ZERO)
                    .sipDay(null).build();
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));

            scheduler.checkUpcomingSips();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("skips a fund with a SIP day but no SIP amount")
        void skipsFundWithNoAmount() {
            Investment inv = Investment.builder()
                    .userId(UUID.randomUUID())
                    .investmentType(InvestmentType.MUTUAL_FUND)
                    .investedAmount(BigDecimal.ZERO).currentValue(BigDecimal.ZERO)
                    .sipDay(LocalDate.now().plusDays(2).getDayOfMonth()).sipAmount(null).build();
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));

            scheduler.checkUpcomingSips();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("rolls into next month once this month's SIP date has already passed")
        void rollsIntoNextMonthWhenPassed() {
            LocalDate today = LocalDate.now();
            LocalDate expectedNext = today.getDayOfMonth() == 1 ? today : today.plusMonths(1).withDayOfMonth(1);
            org.junit.jupiter.api.Assumptions.assumeTrue(!expectedNext.isEqual(today.plusDays(2)));
            Investment inv = mf(1);
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));

            scheduler.checkUpcomingSips();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("continues processing remaining funds when one throws")
        void continuesAfterException() {
            LocalDate target = LocalDate.now().plusDays(2);
            Investment failing = mf(target.getDayOfMonth());
            Investment succeeding = mf(target.getDayOfMonth());
            when(investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE))
                    .thenReturn(List.of(failing, succeeding));
            doThrow(new RuntimeException("boom")).when(notificationService)
                    .createSipUpcomingNotification(eq(failing.getUserId()), any(), any(), any());

            scheduler.checkUpcomingSips();

            verify(notificationService).createSipUpcomingNotification(
                    eq(succeeding.getUserId()), any(), any(), any());
        }
    }
}
