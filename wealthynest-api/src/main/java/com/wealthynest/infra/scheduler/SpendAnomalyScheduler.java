package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Flags expenses that are much larger than a user's usual spend in that category — a simple
 * statistical threshold (trailing 30-day average, minimum sample size), not ML, in the same
 * spirit as the existing budget-breach check.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SpendAnomalyScheduler {

    private static final int MIN_SAMPLE_SIZE = 5;
    private static final BigDecimal ANOMALY_MULTIPLIER = BigDecimal.valueOf(3);
    private static final int TRAILING_WINDOW_DAYS = 30;

    private final ExpenseRepository   expenseRepository;
    private final CategoryRepository  categoryRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public void checkRecentExpenses() {
        Instant since = Instant.now().minus(1, ChronoUnit.DAYS);
        List<Expense> candidates = expenseRepository.findByCreatedAtAfterAndDebtFalse(since);
        int flagged = 0;
        for (Expense e : candidates) {
            try {
                if (checkOne(e)) flagged++;
            } catch (Exception ex) {
                log.warn("Anomaly check failed for expense={}: {}", e.getId(), ex.getMessage());
            }
        }
        log.info("Spend anomaly sweep complete: {} of {} recent expense(s) flagged", flagged, candidates.size());
    }

    private boolean checkOne(Expense e) {
        LocalDate end   = e.getExpenseDate().minusDays(1);
        LocalDate start = e.getExpenseDate().minusDays(TRAILING_WINDOW_DAYS);
        if (end.isBefore(start)) return false;

        List<Object[]> rows = expenseRepository.avgAndCountByUserCategoryAndDateRangeExcluding(
                e.getUserId(), e.getCategoryId(), start, end, e.getId());
        if (rows.isEmpty()) return false;
        BigDecimal average = (BigDecimal) rows.get(0)[0];
        long count = ((Number) rows.get(0)[1]).longValue();
        if (count < MIN_SAMPLE_SIZE || average.compareTo(BigDecimal.ZERO) <= 0) return false;

        BigDecimal threshold = average.multiply(ANOMALY_MULTIPLIER).setScale(2, RoundingMode.HALF_UP);
        if (e.getAmount().compareTo(threshold) <= 0) return false;

        String categoryName = categoryRepository.findById(e.getCategoryId()).map(Category::getName).orElse("this category");
        notificationService.createSpendAnomalyNotification(e.getUserId(), categoryName, e.getAmount(), average);
        return true;
    }
}
