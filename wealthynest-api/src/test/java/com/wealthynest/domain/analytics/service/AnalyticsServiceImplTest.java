package com.wealthynest.domain.analytics.service;

import com.wealthynest.domain.analytics.dto.response.BudgetSummaryResponse;
import com.wealthynest.domain.analytics.dto.response.CategorySpendingResponse;
import com.wealthynest.domain.analytics.dto.response.DashboardResponse;
import com.wealthynest.domain.analytics.dto.response.MonthlyTrendResponse;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.service.NetWorthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceImplTest {

    @Mock private NetWorthService               netWorthService;
    @Mock private ExpenseRepository             expenseRepository;
    @Mock private InvestmentRepository          investmentRepository;
    @Mock private InvestmentIncomeLogRepository incomeLogRepository;
    @Mock private BudgetRepository              budgetRepository;
    @Mock private CategoryRepository            categoryRepository;
    @Mock private IncomeRepository              incomeRepository;

    @InjectMocks
    private AnalyticsServiceImpl service;

    private final UUID userId     = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();

    private Category category(UUID id, String name) {
        Category c = Category.builder().name(name).color("#22c55e").icon("cart").type(CategoryType.EXPENSE).build();
        ReflectionTestUtils.setField(c, "id", id);
        return c;
    }

    /** Stubs every dashboard dependency with harmless/empty defaults so a single scenario's
     * overrides don't have to restub the whole graph. */
    private void stubDashboardDefaults(int year, int month) {
        lenient().when(netWorthService.getSummary(userId, null))
                .thenReturn(NetWorthSummaryResponse.builder().totalNetWorth(BigDecimal.ZERO).build());
        lenient().when(expenseRepository.sumByUserAndMonth(userId, year, month)).thenReturn(BigDecimal.ZERO);
        lenient().when(incomeRepository.sumByUserAndPeriod(userId, year, month)).thenReturn(BigDecimal.ZERO);
        lenient().when(investmentRepository.sumInvestedAmountByUser(userId)).thenReturn(BigDecimal.ZERO);
        lenient().when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(BigDecimal.ZERO);
        lenient().when(incomeLogRepository.sumByUserAndIncomeType(eq(userId), any())).thenReturn(BigDecimal.ZERO);
        lenient().when(categoryRepository.findByUserIdOrSystemIncludingArchived(userId)).thenReturn(List.of());
        lenient().when(expenseRepository.findCategorySpendingByUser(eq(userId), anyInt(), anyInt())).thenReturn(List.of());
        lenient().when(budgetRepository.findByUserId(userId)).thenReturn(List.of());
        lenient().when(expenseRepository.sumByUserAndYearGroupedByCategory(eq(userId), anyInt())).thenReturn(List.of());
        lenient().when(incomeRepository.sumByUserAndYearGroupedByMonth(eq(userId), anyInt())).thenReturn(List.of());
        lenient().when(expenseRepository.sumByUserAndYearGroupedByMonth(eq(userId), anyInt())).thenReturn(List.of());
    }

    // ─── getDashboard ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getDashboard")
    class GetDashboardTests {

        @Test
        @DisplayName("all null aggregate sums are treated as zero, never NPE")
        void nullSumsTreatedAsZero() {
            stubDashboardDefaults(2026, 6);
            when(netWorthService.getSummary(userId, null)).thenReturn(NetWorthSummaryResponse.builder().totalNetWorth(null).build());
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(null);
            when(incomeRepository.sumByUserAndPeriod(userId, 2026, 6)).thenReturn(null);
            when(investmentRepository.sumInvestedAmountByUser(userId)).thenReturn(null);
            when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(null);

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getTotalNetWorth()).isEqualByComparingTo("0");
            assertThat(response.getMonthlyExpenses()).isEqualByComparingTo("0");
            assertThat(response.getMonthlyIncome()).isEqualByComparingTo("0");
            assertThat(response.getTotalInvested()).isEqualByComparingTo("0");
            assertThat(response.getTotalInvestmentValue()).isEqualByComparingTo("0");
            assertThat(response.getSavingsRate()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("totalDividendIncome sums DIVIDEND + BOND_COUPON + FD_MATURITY income-log totals")
        void sumsAllThreeIncomeLogTypes() {
            stubDashboardDefaults(2026, 6);
            when(incomeLogRepository.sumByUserAndIncomeType(userId, "DIVIDEND")).thenReturn(new BigDecimal("100"));
            when(incomeLogRepository.sumByUserAndIncomeType(userId, "BOND_COUPON")).thenReturn(new BigDecimal("200"));
            when(incomeLogRepository.sumByUserAndIncomeType(userId, "FD_MATURITY")).thenReturn(new BigDecimal("300"));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getTotalDividendIncome()).isEqualByComparingTo("600");
        }

        @Test
        @DisplayName("savings rate: (income - expenses) / income * 100")
        void savingsRateCalculation() {
            stubDashboardDefaults(2026, 6);
            when(incomeRepository.sumByUserAndPeriod(userId, 2026, 6)).thenReturn(new BigDecimal("10000"));
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("6000"));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getSavingsRate()).isEqualByComparingTo("40.00");
        }

        @Test
        @DisplayName("savings rate goes negative when expenses exceed income, distinct from an exact break-even month")
        void savingsRateGoesNegativeOnOverspend() {
            stubDashboardDefaults(2026, 6);
            when(incomeRepository.sumByUserAndPeriod(userId, 2026, 6)).thenReturn(new BigDecimal("1000"));
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("1200"));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getSavingsRate()).isEqualByComparingTo("-20.00");
        }

        @Test
        @DisplayName("savings rate is exactly zero on a break-even month (income spent in full, not exceeded)")
        void savingsRateZeroOnBreakEven() {
            stubDashboardDefaults(2026, 6);
            when(incomeRepository.sumByUserAndPeriod(userId, 2026, 6)).thenReturn(new BigDecimal("1000"));
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("1000"));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getSavingsRate()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("savings rate is zero (not a divide error) when monthly income is zero")
        void savingsRateZeroWhenNoIncome() {
            stubDashboardDefaults(2026, 6);
            when(incomeRepository.sumByUserAndPeriod(userId, 2026, 6)).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("500"));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            assertThat(response.getSavingsRate()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("category breakdown resolves name/color/icon from the preloaded category map")
        void categoryBreakdownResolvesKnownCategory() {
            stubDashboardDefaults(2026, 6);
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("1000"));
            when(categoryRepository.findByUserIdOrSystemIncludingArchived(userId))
                    .thenReturn(List.of(category(categoryId, "Groceries")));
            when(expenseRepository.findCategorySpendingByUser(userId, 2026, 6))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("250")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            CategorySpendingResponse cat = response.getCategoryBreakdown().get(0);
            assertThat(cat.getCategoryName()).isEqualTo("Groceries");
            assertThat(cat.getPercentage()).isEqualTo(25.0); // 250/1000 * 100
        }

        @Test
        @DisplayName("category breakdown falls back to 'Other' for a category not in the preloaded map")
        void categoryBreakdownDefaultsForUnknownCategory() {
            stubDashboardDefaults(2026, 6);
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(new BigDecimal("1000"));
            when(expenseRepository.findCategorySpendingByUser(userId, 2026, 6))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("100")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            CategorySpendingResponse cat = response.getCategoryBreakdown().get(0);
            assertThat(cat.getCategoryName()).isEqualTo("Other");
            assertThat(cat.getCategoryColor()).isEqualTo("#6366f1");
        }

        @Test
        @DisplayName("category percentage uses 1 (not 0) as the divisor when monthly spend is zero, avoiding a divide error")
        void categoryPercentageGuardsZeroTotal() {
            stubDashboardDefaults(2026, 6);
            when(expenseRepository.sumByUserAndMonth(userId, 2026, 6)).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.findCategorySpendingByUser(userId, 2026, 6))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("50")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            // amt / 1 * 100 per the guard's fallback divisor, not a thrown ArithmeticException
            assertThat(response.getCategoryBreakdown().get(0).getPercentage()).isEqualTo(5000.0);
        }

        @Test
        @DisplayName("MONTHLY budgets are compared against the month's spend, YEARLY budgets against the year's spend")
        void budgetSummariesUseCorrectSpendWindow() {
            stubDashboardDefaults(2026, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            UUID yearlyCatId = UUID.randomUUID();
            Budget yearly = Budget.builder().categoryId(yearlyCatId).amount(new BigDecimal("50000")).budgetType(BudgetType.YEARLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly, yearly));
            when(expenseRepository.findCategorySpendingByUser(userId, 2026, 6))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("300")}));
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{yearlyCatId, new BigDecimal("40000")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            BudgetSummaryResponse monthlySummary = response.getBudgetSummaries().stream()
                    .filter(b -> b.getCategoryId().equals(categoryId)).findFirst().orElseThrow();
            BudgetSummaryResponse yearlySummary = response.getBudgetSummaries().stream()
                    .filter(b -> b.getCategoryId().equals(yearlyCatId)).findFirst().orElseThrow();
            assertThat(monthlySummary.getSpent()).isEqualByComparingTo("300");
            assertThat(yearlySummary.getSpent()).isEqualByComparingTo("40000");
            assertThat(yearlySummary.isOverBudget()).isFalse();
            // budgetType must be on the response — a category can have both a MONTHLY and
            // YEARLY budget, and callers (e.g. the breach-notification dedup) need it to tell
            // the two summaries apart instead of colliding on categoryId alone.
            assertThat(monthlySummary.getBudgetType()).isEqualTo(BudgetType.MONTHLY);
            assertThat(yearlySummary.getBudgetType()).isEqualTo(BudgetType.YEARLY);
        }

        @Test
        @DisplayName("budget summary flags overBudget once spend exceeds the budgeted amount")
        void budgetSummaryFlagsOverBudget() {
            stubDashboardDefaults(2026, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("100")).budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly));
            when(expenseRepository.findCategorySpendingByUser(userId, 2026, 6))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("150")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.getPercentUsed()).isEqualTo(150.0);
            assertThat(summary.isOverBudget()).isTrue();
        }

        @Test
        @DisplayName("paceOverBudget for a YEARLY budget mirrors overBudget")
        void paceOverBudgetMirrorsOverBudgetForYearly() {
            stubDashboardDefaults(2026, 6);
            Budget yearly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000")).budgetType(BudgetType.YEARLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(yearly));
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("1500")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.isOverBudget()).isTrue();
            assertThat(summary.isPaceOverBudget()).isTrue();
        }

        @Test
        @DisplayName("paceOverBudget for a MONTHLY budget, in a fully-elapsed past year, compares against the full x12 cap")
        void paceOverBudgetForMonthlyUsesFullYearCapWhenYearHasFullyElapsed() {
            // 2020 is guaranteed to be a past year, so all 12 months count as elapsed regardless
            // of the real date this test runs on.
            stubDashboardDefaults(2020, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly));
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, 2020))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("12001")})); // just above 1000 x 12

            DashboardResponse response = service.getDashboard(userId, 2020, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.isPaceOverBudget()).isTrue();
        }

        @Test
        @DisplayName("paceOverBudget for a MONTHLY budget stays false when YTD spend is under the full x12 cap in a past year")
        void paceOverBudgetForMonthlyStaysFalseUnderFullYearCap() {
            stubDashboardDefaults(2020, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly));
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, 2020))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("11999")})); // just under 1000 x 12

            DashboardResponse response = service.getDashboard(userId, 2020, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.isPaceOverBudget()).isFalse();
        }

        @Test
        @DisplayName("paceOverBudget for a MONTHLY budget never fires for a year that hasn't started yet")
        void paceOverBudgetForMonthlyStaysFalseForFutureYear() {
            int futureYear = java.time.LocalDate.now().getYear() + 5;
            stubDashboardDefaults(futureYear, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1")).budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly));
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, futureYear))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, new BigDecimal("1000000")}));

            DashboardResponse response = service.getDashboard(userId, futureYear, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.isPaceOverBudget()).isFalse();
        }

        @Test
        @DisplayName("paceOverBudget for a MONTHLY budget, in the current year, is pro-rated by the real elapsed month count")
        void paceOverBudgetForMonthlyIsProRatedInCurrentYear() {
            int currentYear = java.time.LocalDate.now().getYear();
            int elapsed     = java.time.LocalDate.now().getMonthValue();
            stubDashboardDefaults(currentYear, 6);
            Budget monthly = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly));
            BigDecimal justOverPace = new BigDecimal("1000").multiply(BigDecimal.valueOf(elapsed)).add(BigDecimal.ONE);
            when(expenseRepository.sumByUserAndYearGroupedByCategory(userId, currentYear))
                    .thenReturn(List.<Object[]>of(new Object[]{categoryId, justOverPace}));

            DashboardResponse response = service.getDashboard(userId, currentYear, 6);

            BudgetSummaryResponse summary = response.getBudgetSummaries().get(0);
            assertThat(summary.isPaceOverBudget()).isTrue();
        }

        @Test
        @DisplayName("6-month trend wraps across a year boundary and does not floor a negative 'saved'")
        void monthlyTrendWrapsYearBoundaryAllowsNegativeSaved() {
            stubDashboardDefaults(2026, 2); // Feb -> trend spans back into the previous year
            // Nov of prior year: income 100, expense 500 -> -400, unclamped — matches getAnnualTrend
            // below. A floor here used to silently hide a real overspending month, which inflated
            // the historical average the frontend's Smart Insights pace forecast compares the
            // current month against; see getDashboard's own comment on tSaved.
            when(incomeRepository.sumByUserAndYearGroupedByMonth(userId, 2025))
                    .thenReturn(List.<Object[]>of(new Object[]{11, new BigDecimal("100")}));
            when(expenseRepository.sumByUserAndYearGroupedByMonth(userId, 2025))
                    .thenReturn(List.<Object[]>of(new Object[]{11, new BigDecimal("500")}));

            DashboardResponse response = service.getDashboard(userId, 2026, 2);

            assertThat(response.getMonthlyTrend()).hasSize(6);
            MonthlyTrendResponse novEntry = response.getMonthlyTrend().stream()
                    .filter(t -> t.getYear() == 2025 && t.getMonth() == 11).findFirst().orElseThrow();
            assertThat(novEntry.getLabel()).isEqualTo("Nov");
            assertThat(novEntry.getSaved()).isEqualByComparingTo("-400");
            // First and last entries in the 6-month window bracket the requested (year, month)
            assertThat(response.getMonthlyTrend().get(5).getYear()).isEqualTo(2026);
            assertThat(response.getMonthlyTrend().get(5).getMonth()).isEqualTo(2);
        }

        @Test
        @DisplayName("trend batches one grouped query per distinct year touched, not one per month")
        void trendBatchesQueriesPerDistinctYear() {
            stubDashboardDefaults(2026, 2); // touches 2025 and 2026 only, across 6 months

            service.getDashboard(userId, 2026, 2);

            verify(incomeRepository, times(2)).sumByUserAndYearGroupedByMonth(eq(userId), anyInt());
            verify(expenseRepository, times(2)).sumByUserAndYearGroupedByMonth(eq(userId), anyInt());
        }
    }

    // ─── getAnnualTrend ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAnnualTrend")
    class GetAnnualTrendTests {

        @Test
        @DisplayName("returns exactly 12 months, defaulting missing months to zero")
        void returnsAllTwelveMonths() {
            when(incomeRepository.sumByUserAndYearGroupedByMonth(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{3, new BigDecimal("5000")}));
            when(expenseRepository.sumByUserAndYearGroupedByMonth(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{3, new BigDecimal("2000")}));

            List<MonthlyTrendResponse> result = service.getAnnualTrend(userId, 2026);

            assertThat(result).hasSize(12);
            MonthlyTrendResponse march = result.get(2);
            assertThat(march.getIncome()).isEqualByComparingTo("5000");
            assertThat(march.getSaved()).isEqualByComparingTo("3000");
            MonthlyTrendResponse january = result.get(0);
            assertThat(january.getIncome()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("does not floor a negative 'saved' at zero — matches the dashboard trend")
        void annualTrendAllowsNegativeSaved() {
            when(incomeRepository.sumByUserAndYearGroupedByMonth(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{6, new BigDecimal("100")}));
            when(expenseRepository.sumByUserAndYearGroupedByMonth(userId, 2026))
                    .thenReturn(List.<Object[]>of(new Object[]{6, new BigDecimal("500")}));

            List<MonthlyTrendResponse> result = service.getAnnualTrend(userId, 2026);

            assertThat(result.get(5).getSaved()).isEqualByComparingTo("-400");
        }

        @Test
        @DisplayName("uses exactly 2 grouped queries total regardless of how many months have data")
        void usesExactlyTwoQueries() {
            when(incomeRepository.sumByUserAndYearGroupedByMonth(userId, 2026)).thenReturn(List.of());
            when(expenseRepository.sumByUserAndYearGroupedByMonth(userId, 2026)).thenReturn(List.of());

            service.getAnnualTrend(userId, 2026);

            verify(incomeRepository, times(1)).sumByUserAndYearGroupedByMonth(userId, 2026);
            verify(expenseRepository, times(1)).sumByUserAndYearGroupedByMonth(userId, 2026);
        }
    }
}
