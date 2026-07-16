package com.wealthynest.domain.analytics.service;

import com.wealthynest.domain.analytics.dto.response.BudgetSummaryResponse;
import com.wealthynest.domain.analytics.dto.response.CategorySpendingResponse;
import com.wealthynest.domain.analytics.dto.response.DashboardResponse;
import com.wealthynest.domain.analytics.dto.response.MonthlyTrendResponse;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.networth.service.NetWorthService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {
    private final NetWorthService               netWorthService;
    private final ExpenseRepository             expenseRepository;
    private final InvestmentRepository          investmentRepository;
    private final InvestmentIncomeLogRepository incomeLogRepository;
    private final BudgetRepository              budgetRepository;
    private final CategoryRepository            categoryRepository;
    private final IncomeRepository              incomeRepository;

    @Override
    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID userId, int year, int month) {
        BigDecimal netWorth = netWorthService.getSummary(userId, null).getTotalNetWorth();
        if (netWorth == null) netWorth = BigDecimal.ZERO;

        BigDecimal monthlyExp = expenseRepository.sumByUserAndMonth(userId, year, month);
        if (monthlyExp == null) monthlyExp = BigDecimal.ZERO;

        BigDecimal monthlyIncome = incomeRepository.sumByUserAndPeriod(userId, year, month);
        if (monthlyIncome == null) monthlyIncome = BigDecimal.ZERO;

        BigDecimal totalInvested  = investmentRepository.sumInvestedAmountByUser(userId);
        BigDecimal totalInvValue  = investmentRepository.sumCurrentValueByUser(userId);
        BigDecimal totalDividends = incomeLogRepository.sumByUserAndIncomeType(userId, "DIVIDEND")
            .add(incomeLogRepository.sumByUserAndIncomeType(userId, "BOND_COUPON"))
            .add(incomeLogRepository.sumByUserAndIncomeType(userId, "FD_MATURITY"));
        if (totalInvested  == null) totalInvested  = BigDecimal.ZERO;
        if (totalInvValue  == null) totalInvValue  = BigDecimal.ZERO;
        if (totalDividends == null) totalDividends = BigDecimal.ZERO;

        // Category breakdown
        Map<UUID, Category> catMap = categoryRepository.findAll().stream()
                .collect(Collectors.toMap(Category::getId, c -> c));

        List<Object[]> catRows = expenseRepository.findCategorySpendingByUser(userId, year, month);

        BigDecimal totalForPct = monthlyExp.compareTo(BigDecimal.ZERO) > 0 ? monthlyExp : BigDecimal.ONE;
        List<CategorySpendingResponse> categoryBreakdown = catRows.stream().map(row -> {
            UUID catId  = (UUID) row[0];
            BigDecimal amt = (BigDecimal) row[1];
            Category cat = catMap.get(catId);
            double pct = amt.divide(totalForPct, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).doubleValue();
            return CategorySpendingResponse.builder()
                    .categoryId(catId)
                    .categoryName(cat != null ? cat.getName()  : "Other")
                    .categoryColor(cat != null ? cat.getColor() : "#6366f1")
                    .categoryIcon(cat != null ? cat.getIcon()  : "receipt")
                    .amount(amt).percentage(pct)
                    .build();
        }).toList();

        // Budget summaries — budgets are now templates, fetch all and compute spent for this period.
        // Spend is fetched via two grouped-by-category queries (not one query per budget).
        List<Budget> budgets = budgetRepository.findByUserId(userId);
        Map<UUID, BigDecimal> monthlySpendByCategory = toUuidMap(expenseRepository.findCategorySpendingByUser(userId, year, month));
        Map<UUID, BigDecimal> yearlySpendByCategory   = toUuidMap(expenseRepository.sumByUserAndYearGroupedByCategory(userId, year));

        List<BudgetSummaryResponse> budgetSummaries = budgets.stream().map(b -> {
            boolean isYearly = com.wealthynest.domain.budget.entity.BudgetType.YEARLY.equals(b.getBudgetType());
            BigDecimal spent = isYearly
                ? yearlySpendByCategory.getOrDefault(b.getCategoryId(), BigDecimal.ZERO)
                : monthlySpendByCategory.getOrDefault(b.getCategoryId(), BigDecimal.ZERO);
            double pct = b.getAmount().compareTo(BigDecimal.ZERO) > 0
                    ? spent.divide(b.getAmount(), 4, RoundingMode.HALF_UP)
                           .multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 0.0;
            Category cat = catMap.get(b.getCategoryId());
            return BudgetSummaryResponse.builder()
                    .categoryId(b.getCategoryId())
                    .categoryName(cat != null ? cat.getName() : "Unknown")
                    .categoryColor(cat != null ? cat.getColor() : "#6366f1")
                    .categoryIcon(cat != null ? cat.getIcon()  : "more-horizontal")
                    .budgeted(b.getAmount()).spent(spent)
                    .percentUsed(pct).overBudget(pct > 100).build();
        }).toList();

        // Savings rate: (income - expenses) / income * 100
        BigDecimal savingsRate = monthlyIncome.compareTo(BigDecimal.ZERO) > 0
                ? monthlyIncome.subtract(monthlyExp)
                               .divide(monthlyIncome, 4, RoundingMode.HALF_UP)
                               .multiply(BigDecimal.valueOf(100))
                               .max(BigDecimal.ZERO)
                : BigDecimal.ZERO;

        // 6-month trend (going back from the requested month) — batch-fetch per distinct year touched
        // instead of running 2 queries per month (up to 12 queries collapse to at most 4).
        List<int[]> trendPeriods = new java.util.ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            int trendMonth = month - i;
            int trendYear  = year;
            while (trendMonth < 1)  { trendMonth += 12; trendYear--; }
            while (trendMonth > 12) { trendMonth -= 12; trendYear++; }
            trendPeriods.add(new int[]{trendYear, trendMonth});
        }
        Map<Integer, Map<Integer, BigDecimal>> incomeByYearMonth  = new java.util.HashMap<>();
        Map<Integer, Map<Integer, BigDecimal>> expenseByYearMonth = new java.util.HashMap<>();
        for (int trendYear : trendPeriods.stream().map(p -> p[0]).collect(Collectors.toSet())) {
            incomeByYearMonth.put(trendYear, toMonthMap(incomeRepository.sumByUserAndYearGroupedByMonth(userId, trendYear)));
            expenseByYearMonth.put(trendYear, toMonthMap(expenseRepository.sumByUserAndYearGroupedByMonth(userId, trendYear)));
        }

        List<MonthlyTrendResponse> monthlyTrend = new java.util.ArrayList<>();
        for (int[] period : trendPeriods) {
            int trendYear = period[0], trendMonth = period[1];
            BigDecimal tIncome  = incomeByYearMonth.get(trendYear).getOrDefault(trendMonth, BigDecimal.ZERO);
            BigDecimal tExpense = expenseByYearMonth.get(trendYear).getOrDefault(trendMonth, BigDecimal.ZERO);
            BigDecimal tSaved = tIncome.subtract(tExpense).max(BigDecimal.ZERO);
            String lbl = java.time.LocalDate.of(trendYear, trendMonth, 1)
                    .getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            monthlyTrend.add(MonthlyTrendResponse.builder()
                    .year(trendYear).month(trendMonth).label(lbl)
                    .income(tIncome).expenses(tExpense).saved(tSaved)
                    .build());
        }

        return DashboardResponse.builder()
                .totalNetWorth(netWorth)
                .monthlyExpenses(monthlyExp)
                .monthlyIncome(monthlyIncome)
                .savingsRate(savingsRate)
                .totalInvested(totalInvested)
                .totalInvestmentValue(totalInvValue)
                .totalDividendIncome(totalDividends)
                .categoryBreakdown(categoryBreakdown)
                .budgetSummaries(budgetSummaries)
                .monthlyTrend(monthlyTrend)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MonthlyTrendResponse> getAnnualTrend(UUID userId, int year) {
        // 2 grouped queries for the whole year instead of 2 x 12 per-month queries.
        Map<Integer, BigDecimal> incomeByMonth  = toMonthMap(incomeRepository.sumByUserAndYearGroupedByMonth(userId, year));
        Map<Integer, BigDecimal> expenseByMonth = toMonthMap(expenseRepository.sumByUserAndYearGroupedByMonth(userId, year));
        List<MonthlyTrendResponse> result = new java.util.ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            BigDecimal income  = incomeByMonth.getOrDefault(m, BigDecimal.ZERO);
            BigDecimal expense = expenseByMonth.getOrDefault(m, BigDecimal.ZERO);
            String label = java.time.Month.of(m)
                    .getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH);
            result.add(MonthlyTrendResponse.builder()
                    .year(year).month(m).label(label)
                    .income(income).expenses(expense)
                    .saved(income.subtract(expense))
                    .build());
        }
        return result;
    }

    private Map<UUID, BigDecimal> toUuidMap(List<Object[]> rows) {
        Map<UUID, BigDecimal> map = new java.util.HashMap<>();
        for (Object[] row : rows) map.put((UUID) row[0], (BigDecimal) row[1]);
        return map;
    }

    private Map<Integer, BigDecimal> toMonthMap(List<Object[]> rows) {
        Map<Integer, BigDecimal> map = new java.util.HashMap<>();
        for (Object[] row : rows) map.put(((Number) row[0]).intValue(), (BigDecimal) row[1]);
        return map;
    }
}
