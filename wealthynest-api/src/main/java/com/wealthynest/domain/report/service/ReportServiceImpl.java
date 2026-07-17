package com.wealthynest.domain.report.service;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.report.dto.ReportCsv;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final ExpenseRepository  expenseRepository;
    private final IncomeRepository   incomeRepository;
    private final CategoryRepository categoryRepository;

    @Override
    @Transactional(readOnly = true)
    public ReportCsv generateMonthlyReport(UUID userId, int year, int month) {
        List<Expense>     expenses = expenseRepository.findByUserAndMonth(userId, year, month);
        List<IncomeEntry> incomes  = incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(userId, year, month);

        Map<UUID, String> catNames = buildCategoryMap(expenses);

        StringBuilder sb = new StringBuilder();
        String monthName = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        sb.append("WealthyNest Monthly Report — ").append(monthName).append(" ").append(year).append("\n\n");

        sb.append("EXPENSES\n");
        sb.append("Date,Category,Description,Payment Method,Amount (INR)\n");
        BigDecimal totalExpenses = BigDecimal.ZERO;
        for (Expense e : expenses) {
            String cat = catNames.getOrDefault(e.getCategoryId(), "Other");
            sb.append(e.getExpenseDate()).append(',')
              .append(esc(cat)).append(',')
              .append(esc(e.getDescription())).append(',')
              .append(e.getPaymentMethod() != null ? e.getPaymentMethod().name() : "").append(',')
              .append(e.getAmount()).append('\n');
            totalExpenses = totalExpenses.add(e.getAmount());
        }
        sb.append(",,,,\n");
        sb.append("Total Expenses,,,,").append(totalExpenses).append("\n\n");

        sb.append("INCOME\n");
        sb.append("Date,Source,Description,Amount (INR)\n");
        BigDecimal totalIncome = BigDecimal.ZERO;
        for (IncomeEntry i : incomes) {
            sb.append(i.getIncomeDate()).append(',')
              .append(i.getSource().name().replace('_', ' ')).append(',')
              .append(esc(i.getDescription())).append(',')
              .append(i.getAmount()).append('\n');
            totalIncome = totalIncome.add(i.getAmount());
        }
        sb.append(",,,\n");
        sb.append("Total Income,,,").append(totalIncome).append("\n\n");

        sb.append("SUMMARY\n");
        sb.append("Period,").append(monthName).append(" ").append(year).append('\n');
        sb.append("Total Income,").append(totalIncome).append('\n');
        sb.append("Total Expenses,").append(totalExpenses).append('\n');
        sb.append("Net Savings,").append(totalIncome.subtract(totalExpenses)).append('\n');

        return new ReportCsv(toBytes(sb), String.format("WealthyNest-%d-%02d-Monthly.csv", year, month));
    }

    @Override
    @Transactional(readOnly = true)
    public ReportCsv generateAnnualReport(UUID userId, int year) {
        List<Expense>     expenses = expenseRepository.findByUserAndYear(userId, year);
        List<IncomeEntry> incomes  = incomeRepository.findByUserAndYear(userId, year);

        Map<UUID, String> catNames = buildCategoryMap(expenses);

        StringBuilder sb = new StringBuilder();
        sb.append("WealthyNest Annual Report — ").append(year).append("\n\n");

        sb.append("MONTHLY SUMMARY\n");
        sb.append("Month,Income (INR),Expenses (INR),Net Savings (INR)\n");
        BigDecimal grandIncome   = BigDecimal.ZERO;
        BigDecimal grandExpenses = BigDecimal.ZERO;
        for (int m = 1; m <= 12; m++) {
            final int mm = m;
            BigDecimal mInc = incomes.stream()
                    .filter(i -> i.getPeriodMonth() == mm)
                    .map(IncomeEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal mExp = expenses.stream()
                    .filter(e -> e.getExpenseDate().getMonthValue() == mm)
                    .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            String mName = Month.of(m).getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
            sb.append(mName).append(',').append(mInc).append(',').append(mExp)
              .append(',').append(mInc.subtract(mExp)).append('\n');
            grandIncome   = grandIncome.add(mInc);
            grandExpenses = grandExpenses.add(mExp);
        }
        sb.append("TOTAL,").append(grandIncome).append(',').append(grandExpenses)
          .append(',').append(grandIncome.subtract(grandExpenses)).append("\n\n");

        sb.append("ALL EXPENSES\n");
        sb.append("Date,Category,Description,Payment Method,Amount (INR)\n");
        for (Expense e : expenses) {
            String cat = catNames.getOrDefault(e.getCategoryId(), "Other");
            sb.append(e.getExpenseDate()).append(',')
              .append(esc(cat)).append(',')
              .append(esc(e.getDescription())).append(',')
              .append(e.getPaymentMethod() != null ? e.getPaymentMethod().name() : "").append(',')
              .append(e.getAmount()).append('\n');
        }
        sb.append('\n');

        sb.append("ALL INCOME\n");
        sb.append("Date,Source,Description,Amount (INR)\n");
        for (IncomeEntry i : incomes) {
            sb.append(i.getIncomeDate()).append(',')
              .append(i.getSource().name().replace('_', ' ')).append(',')
              .append(esc(i.getDescription())).append(',')
              .append(i.getAmount()).append('\n');
        }

        return new ReportCsv(toBytes(sb), String.format("WealthyNest-%d-Annual.csv", year));
    }

    private Map<UUID, String> buildCategoryMap(List<Expense> expenses) {
        Set<UUID> ids = expenses.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        return categoryRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));
    }

    private static byte[] toBytes(StringBuilder sb) {
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String esc(String v) {
        if (v == null || v.isBlank()) return "";
        String value = v;
        // Prevent CSV formula injection: Excel/Sheets treat a cell starting with
        // =, +, -, @ (or a tab/CR) as a formula to evaluate, even when quoted.
        // Prefixing a literal apostrophe forces it to be read as plain text.
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            value = "'" + value;
        }
        return (value.contains(",") || value.contains("\"") || value.contains("\n"))
                ? "\"" + value.replace("\"", "\"\"") + "\""
                : value;
    }
}
