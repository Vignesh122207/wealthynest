package com.wealthynest.domain.report.controller;

import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.repository.IncomeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ExpenseRepository  expenseRepository;
    private final IncomeRepository   incomeRepository;
    private final CategoryRepository categoryRepository;

    // ─── Monthly CSV ─────────────────────────────────────────────────────────

    @GetMapping("/monthly")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> monthlyReport(
            @RequestParam int year,
            @RequestParam int month) {

        UUID userId = SecurityUtils.requireCurrentUserId();

        List<Expense>     expenses = expenseRepository.findByUserAndMonth(userId, year, month);
        List<IncomeEntry> incomes  = incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(userId, year, month);

        Map<UUID, String> catNames = buildCategoryMap(expenses);

        StringBuilder sb = new StringBuilder();
        String monthName = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        sb.append("WealthyNest Monthly Report — ").append(monthName).append(" ").append(year).append("\n\n");

        // ── Expenses ──────────────────────────────────────────────────────────
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

        // ── Income ────────────────────────────────────────────────────────────
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

        // ── Summary ───────────────────────────────────────────────────────────
        sb.append("SUMMARY\n");
        sb.append("Period,").append(monthName).append(" ").append(year).append('\n');
        sb.append("Total Income,").append(totalIncome).append('\n');
        sb.append("Total Expenses,").append(totalExpenses).append('\n');
        sb.append("Net Savings,").append(totalIncome.subtract(totalExpenses)).append('\n');

        return csvResponse(sb.toString(),
                String.format("WealthyNest-%d-%02d-Monthly.csv", year, month));
    }

    // ─── Annual CSV ───────────────────────────────────────────────────────────

    @GetMapping("/annual")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> annualReport(@RequestParam int year) {

        UUID userId = SecurityUtils.requireCurrentUserId();

        List<Expense>     expenses = expenseRepository.findByUserAndYear(userId, year);
        List<IncomeEntry> incomes  = incomeRepository.findByUserAndYear(userId, year);

        Map<UUID, String> catNames = buildCategoryMap(expenses);

        StringBuilder sb = new StringBuilder();
        sb.append("WealthyNest Annual Report — ").append(year).append("\n\n");

        // ── Monthly Summary ──────────────────────────────────────────────────
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

        // ── All Expenses ─────────────────────────────────────────────────────
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

        // ── All Income ───────────────────────────────────────────────────────
        sb.append("ALL INCOME\n");
        sb.append("Date,Source,Description,Amount (INR)\n");
        for (IncomeEntry i : incomes) {
            sb.append(i.getIncomeDate()).append(',')
              .append(i.getSource().name().replace('_', ' ')).append(',')
              .append(esc(i.getDescription())).append(',')
              .append(i.getAmount()).append('\n');
        }

        return csvResponse(sb.toString(),
                String.format("WealthyNest-%d-Annual.csv", year));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Map<UUID, String> buildCategoryMap(List<Expense> expenses) {
        Set<UUID> ids = expenses.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        return categoryRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName));
    }

    private static ResponseEntity<byte[]> csvResponse(String content, String filename) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(bytes);
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
