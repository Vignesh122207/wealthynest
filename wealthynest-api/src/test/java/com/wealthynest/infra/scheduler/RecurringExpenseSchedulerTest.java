package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.entity.PaymentMethod;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringExpenseSchedulerTest {

    @Mock private ExpenseRepository expenseRepository;

    @InjectMocks
    private RecurringExpenseScheduler scheduler;

    // ── Shared factory helpers ────────────────────────────────────────────────────

    /**
     * Builds a recurring template expense.  Pass {@code null} for expenseDate or
     * recurrenceRule to exercise the early-return guard inside processTemplate.
     */
    private Expense buildTemplate(LocalDate expenseDate, String recurrenceRule) {
        return Expense.builder()
            .userId(UUID.randomUUID())
            .categoryId(UUID.randomUUID())
            .accountId(UUID.randomUUID())
            .amount(new BigDecimal("1500.00"))
            .currency("INR")
            .description("Monthly subscription")
            .expenseDate(expenseDate)
            .recurring(true)
            .recurrenceRule(recurrenceRule)
            .paymentMethod(PaymentMethod.BANK_ACCOUNT)
            .build();
    }

    // ─── ProcessRecurringExpensesTests ────────────────────────────────────────────

    @Nested
    @DisplayName("processRecurringExpenses")
    class ProcessRecurringExpensesTests {

        @Test
        @DisplayName("no recurring templates in DB → expenseRepository.save never called")
        void noTemplates_nothingProcessed() {
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(Collections.emptyList());

            scheduler.processRecurringExpenses();

            verify(expenseRepository, never()).save(any());
        }

        @Test
        @DisplayName("one template with one overdue date → new expense saved and template date advanced")
        void templateProcessed_newExpenseSavedAndTemplateDateUpdated() {
            // Template last processed 1 month ago → nextDue = today → one new copy
            LocalDate oneMonthAgo = LocalDate.now().minusMonths(1);
            Expense template = buildTemplate(oneMonthAgo, "MONTHLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));
            when(expenseRepository.save(any())).thenReturn(template);

            scheduler.processRecurringExpenses();

            ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
            verify(expenseRepository, times(2)).save(captor.capture());
            List<Expense> saved = captor.getAllValues();

            // First save: the generated copy — must NOT be recurring
            assertThat(saved.get(0).isRecurring()).isFalse();
            // Second save: the updated template — must still be recurring
            assertThat(saved.get(1).isRecurring()).isTrue();
        }
    }

    // ─── ProcessTemplateTests ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("processTemplate (via processRecurringExpenses)")
    class ProcessTemplateTests {

        @Test
        @DisplayName("null expenseDate → processTemplate returns 0, nothing saved")
        void nullExpenseDate_skipped() {
            Expense template = buildTemplate(null, "MONTHLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));

            scheduler.processRecurringExpenses();

            verify(expenseRepository, never()).save(any());
        }

        @Test
        @DisplayName("null recurrenceRule → processTemplate returns 0, nothing saved")
        void nullRecurrenceRule_skipped() {
            Expense template = buildTemplate(LocalDate.now().minusDays(1), null);
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));

            scheduler.processRecurringExpenses();

            verify(expenseRepository, never()).save(any());
        }

        @Test
        @DisplayName("next due date is still in the future → returns 0, nothing saved")
        void nextDueInFuture_skipped_zeroCreated() {
            // expenseDate = today → nextDue = today + 1 month (future)
            Expense template = buildTemplate(LocalDate.now(), "MONTHLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));

            scheduler.processRecurringExpenses();

            verify(expenseRepository, never()).save(any());
        }

        @Test
        @DisplayName("MONTHLY rule with one overdue date → exactly one expense copy saved")
        void monthlyRule_oneDueDateInPast_oneExpenseSaved() {
            // Last processed = 1 month ago → nextDue = today → 1 copy
            Expense template = buildTemplate(LocalDate.now().minusMonths(1), "MONTHLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));
            when(expenseRepository.save(any())).thenReturn(template);

            scheduler.processRecurringExpenses();

            ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
            verify(expenseRepository, times(2)).save(captor.capture()); // 1 copy + 1 template
            assertThat(captor.getAllValues().get(0).isRecurring()).isFalse();
        }

        @Test
        @DisplayName("WEEKLY rule with two overdue dates → two expense copies saved plus one template update")
        void weeklyRule_twoDueDatesInPast_twoExpensesSaved() {
            // Last processed = 14 days ago → nextDue1 = 7 days ago, nextDue2 = today → 2 copies
            Expense template = buildTemplate(LocalDate.now().minusDays(14), "WEEKLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));
            when(expenseRepository.save(any())).thenReturn(template);

            scheduler.processRecurringExpenses();

            // 2 expense copies + 1 template update = 3 saves
            verify(expenseRepository, times(3)).save(any(Expense.class));
        }

        @Test
        @DisplayName("YEARLY rule with one overdue anniversary → one expense copy saved")
        void yearlyRule_happyPath() {
            // Last processed = 1 year ago (same day) → nextDue = today → 1 copy
            Expense template = buildTemplate(LocalDate.now().minusYears(1), "YEARLY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));
            when(expenseRepository.save(any())).thenReturn(template);

            scheduler.processRecurringExpenses();

            ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
            verify(expenseRepository, times(2)).save(captor.capture());
            assertThat(captor.getAllValues().get(0).isRecurring()).isFalse();
        }

        @Test
        @DisplayName("very old DAILY template → safety cap limits saves to 366 copies + 1 template update")
        void safetyCapAt366_veryOldTemplate() {
            // 400 days of backlog with DAILY → cap kicks in at 366 iterations
            Expense template = buildTemplate(LocalDate.now().minusDays(400), "DAILY");
            when(expenseRepository.findAllByRecurringTrue()).thenReturn(List.of(template));
            when(expenseRepository.save(any())).thenReturn(template);

            scheduler.processRecurringExpenses();

            // maxIterations = 366 expense copies + 1 template save
            verify(expenseRepository, times(367)).save(any(Expense.class));
        }
    }

    // ─── AdvanceLogicTests ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("advance (private, tested via reflection)")
    class AdvanceLogicTests {

        private LocalDate callAdvance(String rule, LocalDate input) throws Exception {
            Method advance = RecurringExpenseScheduler.class
                .getDeclaredMethod("advance", LocalDate.class, String.class);
            advance.setAccessible(true);
            return (LocalDate) advance.invoke(scheduler, input, rule);
        }

        @ParameterizedTest(name = "[{index}] rule={0} → {1} becomes {2}")
        @CsvSource({
            "DAILY,    2025-06-15, 2025-06-16",
            "WEEKLY,   2025-06-15, 2025-06-22",
            "BIWEEKLY, 2025-06-15, 2025-06-29",
            "MONTHLY,  2025-06-15, 2025-07-15",
            "YEARLY,   2025-06-15, 2026-06-15",
            "INVALID,  2025-06-15, 2025-07-15"
        })
        @DisplayName("advance correctly advances the date for each recurrence rule")
        void advanceLogic_allRules(String rule, String inputStr, String expectedStr) throws Exception {
            LocalDate input    = LocalDate.parse(inputStr);
            LocalDate expected = LocalDate.parse(expectedStr);

            LocalDate result = callAdvance(rule, input);

            assertThat(result).isEqualTo(expected);
        }

        @Test
        @DisplayName("unknown / misspelled rule falls back to MONTHLY advance")
        void unknownRule_defaultsToMonthly() throws Exception {
            LocalDate base     = LocalDate.of(2025, 3, 31);
            LocalDate expected = base.plusMonths(1); // April 30 (clamped)

            assertThat(callAdvance("FORTNIGHTLY", base)).isEqualTo(expected);
        }
    }
}
