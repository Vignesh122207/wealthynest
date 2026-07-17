package com.wealthynest.domain.budget.service;

import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.request.UpdateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import java.util.List;
import java.util.UUID;

public interface BudgetService {
    BudgetResponse       createOrUpdateBudget(UUID userId, UUID familyId, CreateBudgetRequest request);
    BudgetResponse       updateBudget(UUID budgetId, UUID userId, UUID familyId, UpdateBudgetRequest request);
    List<BudgetResponse> getBudgets(UUID userId, UUID familyId, int year, int month);
    List<BudgetResponse> getBudgetsForCategory(UUID userId, UUID categoryId, int year, int month);
    void                 deleteBudget(UUID budgetId, UUID userId, UUID familyId);
}
