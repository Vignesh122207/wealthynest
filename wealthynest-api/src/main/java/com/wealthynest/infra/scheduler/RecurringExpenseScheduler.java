package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecurringExpenseScheduler {

    private final ExpenseRepository expenseRepository;

    /** Entry point called by JobSchedulerService (and can be triggered manually from Admin). */
    @Transactional
    public void processRecurringExpenses() {
        LocalDate today = LocalDate.now();
        List<Expense> templates = expenseRepository.findAllByRecurringTrue();
        int created = 0;
        for (Expense template : templates) {
            try {
                created += processTemplate(template, today);
            } catch (Exception e) {
                log.error("Error processing recurring expense {}: {}", template.getId(), e.getMessage(), e);
            }
        }
        log.info("Recurring expense run complete: {} new expense(s) created from {} template(s)", created, templates.size());
    }

    private int processTemplate(Expense template, LocalDate today) {
        if (template.getExpenseDate() == null || template.getRecurrenceRule() == null) return 0;
        LocalDate nextDue = advance(template.getExpenseDate(), template.getRecurrenceRule());
        if (nextDue.isAfter(today)) return 0;

        int count = 0;
        int maxIterations = 366; // safety cap — prevents runaway on very old templates
        while (!nextDue.isAfter(today) && maxIterations-- > 0) {
            Expense copy = Expense.builder()
                    .userId(template.getUserId())
                    .familyId(template.getFamilyId())
                    .categoryId(template.getCategoryId())
                    .accountId(template.getAccountId())
                    .amount(template.getAmount())
                    .currency(template.getCurrency())
                    .description(template.getDescription())
                    .notes(template.getNotes())
                    .expenseDate(nextDue)
                    .recurring(false)
                    .paymentMethod(template.getPaymentMethod())
                    .build();
            expenseRepository.save(copy);
            template.setExpenseDate(nextDue);
            nextDue = advance(nextDue, template.getRecurrenceRule());
            count++;
        }
        expenseRepository.save(template);
        return count;
    }

    private LocalDate advance(LocalDate date, String rule) {
        return switch (rule.toUpperCase()) {
            case "DAILY"     -> date.plusDays(1);
            case "WEEKLY"    -> date.plusWeeks(1);
            case "BIWEEKLY"  -> date.plusWeeks(2);
            case "MONTHLY"   -> date.plusMonths(1);
            case "YEARLY"    -> date.plusYears(1);
            default          -> date.plusMonths(1);
        };
    }
}
