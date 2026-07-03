package com.wealthynest.domain.expense.service;

import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.request.UpdateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ExpenseService {
    ExpenseResponse createExpense(UUID userId, UUID familyId, CreateExpenseRequest request);
    ExpenseResponse updateExpense(UUID expenseId, UUID userId, UpdateExpenseRequest request);
    void            deleteExpense(UUID expenseId, UUID userId);
    ExpenseResponse getExpense(UUID expenseId, UUID userId);
    Page<ExpenseResponse> getExpenses(UUID userId, UUID familyId, UUID categoryId,
                                      LocalDate startDate, LocalDate endDate,
                                      String search, List<UUID> accountIds,
                                      BigDecimal minAmount, BigDecimal maxAmount,
                                      Boolean recurring, Boolean includeDebt,
                                      Pageable pageable);

    // Family-scoped: returns all expenses for every member of the family — used by the Family tab only
    Page<ExpenseResponse> getFamilyExpenses(UUID familyId, LocalDate startDate, LocalDate endDate, Pageable pageable);
}
