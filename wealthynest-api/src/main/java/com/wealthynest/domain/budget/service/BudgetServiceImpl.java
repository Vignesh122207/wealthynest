package com.wealthynest.domain.budget.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.request.UpdateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.budget.mapper.BudgetMapper;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.category.service.CategoryOwnershipGuard;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BudgetServiceImpl implements BudgetService {
    private final BudgetRepository   budgetRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseRepository  expenseRepository;
    private final BudgetMapper       budgetMapper;
    private final CategoryOwnershipGuard categoryOwnershipGuard;

    @Override
    @Transactional
    public BudgetResponse createOrUpdateBudget(UUID userId, UUID familyId, CreateBudgetRequest request) {
        categoryOwnershipGuard.validateCategoryOwnership(request.getCategoryId(), userId, familyId);
        BudgetType type = request.getBudgetType() != null ? request.getBudgetType() : BudgetType.MONTHLY;

        // A budget is family-shared whenever its creator currently belongs to a family — same
        // convention as Category/Asset/Liability/Expense (see CategoryServiceImpl.createCategory).
        Budget budget = (familyId != null
                ? budgetRepository.findByFamilyIdAndCategoryIdAndBudgetType(familyId, request.getCategoryId(), type)
                : budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, request.getCategoryId(), type))
            .orElseGet(() -> Budget.builder().userId(userId).familyId(familyId).categoryId(request.getCategoryId())
                .periodMonth(0).periodYear(0).build());
        budget.setAmount(request.getAmount());
        budget.setBudgetType(type);
        budget.setPeriodMonth(0);
        budget.setPeriodYear(0);
        if (request.getAlertThreshold() != null) budget.setAlertThreshold(request.getAlertThreshold());

        LocalDate now = LocalDate.now();
        return enrich(budgetMapper.toResponse(budgetRepository.save(budget)), userId, familyId, now.getYear(), now.getMonthValue());
    }

    @Override
    @Transactional
    public BudgetResponse updateBudget(UUID budgetId, UUID userId, UUID familyId, UpdateBudgetRequest request) {
        Budget budget = findAndValidateOwner(budgetId, userId, familyId);

        if (request.getAmount() != null)          budget.setAmount(request.getAmount());
        if (request.getAlertThreshold() != null)  budget.setAlertThreshold(request.getAlertThreshold());
        if (request.getCategoryId() != null) {
            categoryOwnershipGuard.validateCategoryOwnership(request.getCategoryId(), userId, familyId);
            budget.setCategoryId(request.getCategoryId());
        }

        LocalDate now = LocalDate.now();
        return enrich(budgetMapper.toResponse(budgetRepository.save(budget)), userId, familyId, now.getYear(), now.getMonthValue());
    }

    @Override
    @Transactional(readOnly = true)
    public List<BudgetResponse> getBudgets(UUID userId, UUID familyId, int year, int month) {
        // Family-shared once the caller belongs to a family — mirrors CategoryServiceImpl.getCategories.
        List<Budget> all = familyId != null ? budgetRepository.findByFamilyId(familyId) : budgetRepository.findByUserId(userId);
        // Batch-load all categories upfront to avoid N+1
        Set<UUID> catIds = all.stream().map(Budget::getCategoryId).collect(Collectors.toSet());
        Map<UUID, Category> catMap = categoryRepository.findAllById(catIds).stream()
            .collect(Collectors.toMap(Category::getId, c -> c));
        return all.stream()
            .map(b -> enrich(budgetMapper.toResponse(b), userId, familyId, year, month, catMap))
            .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BudgetResponse> getBudgetsForCategory(UUID userId, UUID categoryId, int year, int month) {
        return budgetRepository.findByUserIdAndCategoryId(userId, categoryId)
            .stream().map(b -> enrich(budgetMapper.toResponse(b), userId, null, year, month)).toList();
    }

    @Override
    @Transactional
    public void deleteBudget(UUID budgetId, UUID userId, UUID familyId) {
        Budget budget = findAndValidateOwner(budgetId, userId, familyId);
        expenseRepository.clearBudgetId(budgetId);
        budgetRepository.delete(budget);
    }

    private Budget findAndValidateOwner(UUID budgetId, UUID userId, UUID familyId) {
        Budget budget = budgetRepository.findById(budgetId)
            .orElseThrow(() -> new ResourceNotFoundException("Budget", "id", budgetId));
        boolean owned = (familyId != null && familyId.equals(budget.getFamilyId()))
                     || (userId   != null && userId.equals(budget.getUserId()));
        if (!owned) throw new AccessDeniedException();
        return budget;
    }

    private BudgetResponse enrich(BudgetResponse r, UUID userId, UUID familyId, int year, int month) {
        return enrich(r, userId, familyId, year, month, null);
    }

    private BudgetResponse enrich(BudgetResponse r, UUID userId, UUID familyId, int year, int month,
                                   Map<UUID, Category> preloadedCats) {
        Category cat = preloadedCats != null
            ? preloadedCats.get(r.getCategoryId())
            : categoryRepository.findById(r.getCategoryId()).orElse(null);
        BigDecimal spent;
        BigDecimal annualSpent;
        if (r.getBudgetType() == BudgetType.YEARLY) {
            spent = familyId != null
                ? expenseRepository.sumByFamilyCategoryAndYear(familyId, r.getCategoryId(), year)
                : expenseRepository.sumByUserCategoryAndYear(userId, r.getCategoryId(), year);
            annualSpent = spent;
        } else {
            spent = familyId != null
                ? expenseRepository.sumByFamilyCategoryAndMonth(familyId, r.getCategoryId(), year, month)
                : expenseRepository.sumByUserCategoryAndMonth(userId, r.getCategoryId(), year, month);
            // Full calendar-year spend in this category, independent of the requested month —
            // lets callers build an annualized total (budgeted monthly x12 + yearly) that pairs
            // with a real actual-spend figure instead of extrapolating from a single month.
            annualSpent = familyId != null
                ? expenseRepository.sumByFamilyCategoryAndYear(familyId, r.getCategoryId(), year)
                : expenseRepository.sumByUserCategoryAndYear(userId, r.getCategoryId(), year);
        }
        if (spent == null) spent = BigDecimal.ZERO;
        if (annualSpent == null) annualSpent = BigDecimal.ZERO;
        BigDecimal remaining = r.getAmount().subtract(spent);
        double pct = r.getAmount().compareTo(BigDecimal.ZERO) > 0
            ? spent.divide(r.getAmount(), 4, RoundingMode.HALF_UP)
                   .multiply(BigDecimal.valueOf(100)).doubleValue()
            : 0.0;
        BigDecimal threshold = r.getAlertThreshold() != null ? r.getAlertThreshold() : BigDecimal.valueOf(80);
        return BudgetResponse.builder()
            .id(r.getId()).categoryId(r.getCategoryId())
            .categoryName(cat != null ? cat.getName() : null)
            .categoryIcon(cat != null ? cat.getIcon() : null)
            .categoryColor(cat != null ? cat.getColor() : null)
            .amount(r.getAmount()).spent(spent).annualSpent(annualSpent).remaining(remaining)
            .percentUsed(pct).overBudget(pct > 100.0)
            .periodMonth(month).periodYear(year)
            .alertThreshold(threshold)
            .alertTriggered(pct >= threshold.doubleValue())
            .budgetType(r.getBudgetType() != null ? r.getBudgetType() : BudgetType.MONTHLY)
            .shared(r.isShared())
            .build();
    }
}
