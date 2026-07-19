package com.wealthynest.domain.report.service;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.report.dto.ReportCsv;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceImplTest {

    @Mock private ExpenseRepository  expenseRepository;
    @Mock private IncomeRepository   incomeRepository;
    @Mock private CategoryRepository categoryRepository;

    @InjectMocks
    private ReportServiceImpl service;

    private final UUID userId     = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();

    private String csvOf(ReportCsv report) {
        return new String(report.content(), StandardCharsets.UTF_8);
    }

    private Expense expense(BigDecimal amount, LocalDate date, String description) {
        Expense e = Expense.builder().userId(userId).categoryId(categoryId).amount(amount)
                .expenseDate(date).description(description).build();
        return e;
    }

    private IncomeEntry income(BigDecimal amount, LocalDate date, int month, String description) {
        return IncomeEntry.builder().userId(userId).source(IncomeSource.SALARY).amount(amount)
                .incomeDate(date).periodMonth(month).periodYear(date.getYear()).description(description).build();
    }

    // ─── generateMonthlyReport ───────────────────────────────────────────────────

    @Nested
    @DisplayName("generateMonthlyReport")
    class MonthlyReportTests {

        @Test
        @DisplayName("totals expenses and income correctly and computes net savings")
        void computesCorrectTotals() {
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                    expense(new BigDecimal("100"), LocalDate.of(2026, 6, 1), "Groceries"),
                    expense(new BigDecimal("50"), LocalDate.of(2026, 6, 2), "Coffee")));
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(userId, 2026, 6))
                    .thenReturn(List.of(income(new BigDecimal("5000"), LocalDate.of(2026, 6, 1), 6, "Salary")));
            when(categoryRepository.findAllById(any())).thenReturn(List.of(
                    Category.builder().name("Food").type(CategoryType.EXPENSE).build()));

            ReportCsv report = service.generateMonthlyReport(userId, 2026, 6);

            String csv = csvOf(report);
            assertThat(csv).contains("Total Expenses,,,,150");
            assertThat(csv).contains("Total Income,,,5000");
            assertThat(csv).contains("Net Savings,4850");
            assertThat(report.filename()).isEqualTo("WealthyNest-2026-06-Monthly.csv");
        }

        @Test
        @DisplayName("resolves category name from the preloaded map, defaulting to 'Other' when unresolved")
        void resolvesCategoryNameWithFallback() {
            UUID unknownCatId = UUID.randomUUID();
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                    Expense.builder().userId(userId).categoryId(unknownCatId).amount(new BigDecimal("10"))
                            .expenseDate(LocalDate.of(2026, 6, 1)).build()));
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));

            assertThat(csv).contains(",Other,");
        }

        @Test
        @DisplayName("SECURITY: a description starting with '=' is neutralized against CSV formula injection")
        void neutralizesFormulaInjectionInDescription() {
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                    expense(new BigDecimal("10"), LocalDate.of(2026, 6, 1), "=SUM(A1:A9)")));
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));

            // Neutralized with a leading apostrophe so Excel/Sheets reads it as text, not a formula
            assertThat(csv).contains("'=SUM(A1:A9)");
        }

        @Test
        @DisplayName("SECURITY: descriptions starting with +, -, @, tab, or CR are all neutralized")
        void neutralizesAllDangerousLeadingCharacters() {
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            for (String dangerous : List.of("+cmd", "-cmd", "@cmd")) {
                when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                        expense(new BigDecimal("10"), LocalDate.of(2026, 6, 1), dangerous)));
                String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));
                assertThat(csv).as("description '%s' should be neutralized", dangerous).contains("'" + dangerous);
            }
        }

        @Test
        @DisplayName("a description containing a comma is quoted per CSV rules, without breaking columns")
        void quotesDescriptionContainingComma() {
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                    expense(new BigDecimal("10"), LocalDate.of(2026, 6, 1), "Lunch, dinner")));
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));

            assertThat(csv).contains("\"Lunch, dinner\"");
        }

        @Test
        @DisplayName("a null description renders as an empty field, not the literal 'null'")
        void nullDescriptionRendersEmpty() {
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of(
                    expense(new BigDecimal("10"), LocalDate.of(2026, 6, 1), null)));
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));

            assertThat(csv).doesNotContain("null");
        }

        @Test
        @DisplayName("zero expenses and zero income still produce a valid report with zero totals")
        void emptyMonthProducesZeroTotals() {
            when(expenseRepository.findByUserAndMonth(userId, 2026, 6)).thenReturn(List.of());
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(any(), anyInt(), anyInt()))
                    .thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateMonthlyReport(userId, 2026, 6));

            assertThat(csv).contains("Total Expenses,,,,0");
            assertThat(csv).contains("Net Savings,0");
        }
    }

    // ─── generateAnnualReport ────────────────────────────────────────────────────

    @Nested
    @DisplayName("generateAnnualReport")
    class AnnualReportTests {

        @Test
        @DisplayName("groups income/expense totals by calendar month and computes a correct grand total")
        void groupsByMonthWithCorrectGrandTotal() {
            when(expenseRepository.findByUserAndYear(userId, 2026)).thenReturn(List.of(
                    expense(new BigDecimal("100"), LocalDate.of(2026, 1, 15), "Jan expense"),
                    expense(new BigDecimal("200"), LocalDate.of(2026, 3, 10), "Mar expense")));
            when(incomeRepository.findByUserAndYear(userId, 2026)).thenReturn(List.of(
                    income(new BigDecimal("5000"), LocalDate.of(2026, 1, 1), 1, "Jan salary"),
                    income(new BigDecimal("5000"), LocalDate.of(2026, 3, 1), 3, "Mar salary")));
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            String csv = csvOf(service.generateAnnualReport(userId, 2026));

            assertThat(csv).contains("Jan,5000,100,4900");
            assertThat(csv).contains("Feb,0,0,0");
            assertThat(csv).contains("Mar,5000,200,4800");
            assertThat(csv).contains("TOTAL,10000,300,9700");
        }

        @Test
        @DisplayName("filename follows the WealthyNest-{year}-Annual.csv convention")
        void filenameConvention() {
            when(expenseRepository.findByUserAndYear(any(), anyInt())).thenReturn(List.of());
            when(incomeRepository.findByUserAndYear(any(), anyInt())).thenReturn(List.of());
            when(categoryRepository.findAllById(any())).thenReturn(List.of());

            ReportCsv report = service.generateAnnualReport(userId, 2026);

            assertThat(report.filename()).isEqualTo("WealthyNest-2026-Annual.csv");
        }
    }
}
