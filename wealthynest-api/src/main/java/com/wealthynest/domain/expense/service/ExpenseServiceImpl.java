package com.wealthynest.domain.expense.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.service.AccountBalanceGuard;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.category.service.CategoryOwnershipGuard;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.request.UpdateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.mapper.ExpenseMapper;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expensesplit.service.ExpenseSplitService;
import com.wealthynest.domain.notification.service.NotificationService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExpenseServiceImpl implements ExpenseService {
    private final ExpenseRepository  expenseRepository;
    private final CategoryRepository categoryRepository;
    private final ExpenseMapper      expenseMapper;
    private final BudgetRepository   budgetRepository;
    private final NotificationService notificationService;
    private final AccountOwnershipGuard  accountOwnershipGuard;
    private final AccountBalanceGuard    accountBalanceGuard;
    private final WalletAccountService   walletAccountService;
    private final ExpenseSplitService    expenseSplitService;
    private final CategoryOwnershipGuard categoryOwnershipGuard;

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public ExpenseResponse createExpense(UUID userId, UUID familyId, CreateExpenseRequest request) {
        categoryOwnershipGuard.validateCategoryOwnership(request.getCategoryId(), userId, familyId);
        accountOwnershipGuard.validateAccountOwnership(request.getAccountId(), userId);
        accountBalanceGuard.validateSufficientBalance(request.getAccountId(), userId, request.getAmount(), BigDecimal.ZERO);
        Expense expense = expenseMapper.toEntity(request);
        expense.setUserId(userId);
        expense.setFamilyId(familyId);
        expense.setBudgetId(request.getBudgetId());
        expense.setAccountId(request.getAccountId());
        Expense saved = expenseRepository.save(expense);
        ExpenseResponse response = enrich(expenseMapper.toResponse(saved));
        checkBudgetBreach(userId, familyId, request.getCategoryId(), request.getExpenseDate());
        walletAccountService.checkLowBalance(request.getAccountId(), userId);
        expenseSplitService.createSplits(saved, request.getSplitWith());
        return response;
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public ExpenseResponse updateExpense(UUID expenseId, UUID userId, UpdateExpenseRequest request) {
        Expense expense = findAndValidateOwner(expenseId, userId);
        BigDecimal previousAmount = expense.getAmount();
        if (request.getCategoryId()    != null) {
            categoryOwnershipGuard.validateCategoryOwnership(request.getCategoryId(), userId, expense.getFamilyId());
            expense.setCategoryId(request.getCategoryId());
        }
        if (request.getAmount()        != null) expense.setAmount(request.getAmount());
        if (request.getDescription()   != null) expense.setDescription(request.getDescription());
        if (request.getNotes()         != null) expense.setNotes(request.getNotes());
        if (request.getExpenseDate()   != null) expense.setExpenseDate(request.getExpenseDate());
        if (request.getRecurring()     != null) expense.setRecurring(request.getRecurring());
        if (request.getRecurrenceRule()!= null) expense.setRecurrenceRule(request.getRecurrenceRule());
        if (request.getPaymentMethod() != null) expense.setPaymentMethod(request.getPaymentMethod());
        if (request.getAmount() != null) {
            expenseSplitService.validateAmountCoversSplits(expenseId, expense.getAmount());
            accountBalanceGuard.validateSufficientBalance(expense.getAccountId(), userId, expense.getAmount(), previousAmount);
        }
        return enrich(expenseMapper.toResponse(expenseRepository.save(expense)));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public void deleteExpense(UUID expenseId, UUID userId) {
        expenseRepository.delete(findAndValidateOwner(expenseId, userId));
    }

    @Override
    @Transactional(readOnly = true)
    public ExpenseResponse getExpense(UUID expenseId, UUID userId) {
        return enrich(expenseMapper.toResponse(findAndValidateOwner(expenseId, userId)));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ExpenseResponse> getExpenses(UUID userId, UUID familyId, UUID categoryId,
                                              LocalDate startDate, LocalDate endDate,
                                              String search, List<UUID> accountIds,
                                              BigDecimal minAmount, BigDecimal maxAmount,
                                              Boolean recurring, Boolean includeDebt,
                                              Pageable pageable) {
        String searchLike = (search != null && !search.isBlank())
                ? "%" + search.toLowerCase() + "%" : null;

        Specification<Expense> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Always scope to the current user — combined family view is in /families/{id}/expenses
            predicates.add(cb.equal(root.get("userId"), userId));
            if (categoryId != null) predicates.add(cb.equal(root.get("categoryId"), categoryId));
            if (startDate  != null) predicates.add(cb.greaterThanOrEqualTo(root.get("expenseDate"), startDate));
            if (endDate    != null) predicates.add(cb.lessThanOrEqualTo(root.get("expenseDate"), endDate));
            if (searchLike != null) predicates.add(cb.like(cb.lower(root.get("description")), searchLike));
            if (accountIds != null && !accountIds.isEmpty()) predicates.add(root.get("accountId").in(accountIds));
            if (minAmount  != null) predicates.add(cb.greaterThanOrEqualTo(root.get("amount"), minAmount));
            if (maxAmount  != null) predicates.add(cb.lessThanOrEqualTo(root.get("amount"), maxAmount));
            if (recurring  != null) predicates.add(cb.equal(root.get("recurring"), recurring));
            if (!Boolean.TRUE.equals(includeDebt)) predicates.add(cb.equal(root.get("debt"), false));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<Expense> page = expenseRepository.findAll(spec, pageable);

        // Batch-load all unique categories to avoid N+1 query per expense
        Set<UUID> catIds = page.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        Map<UUID, Category> catMap = catIds.isEmpty()
            ? Map.of()
            : categoryRepository.findAllById(catIds).stream()
                .collect(Collectors.toMap(Category::getId, c -> c));

        return page.map(expenseMapper::toResponse)
                   .map(r -> enrichWithMap(r, catMap));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ExpenseResponse> getFamilyExpenses(UUID familyId, LocalDate startDate, LocalDate endDate, Pageable pageable) {
        Specification<Expense> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("familyId"), familyId));
            if (startDate != null) predicates.add(cb.greaterThanOrEqualTo(root.get("expenseDate"), startDate));
            if (endDate   != null) predicates.add(cb.lessThanOrEqualTo(root.get("expenseDate"), endDate));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        Page<Expense> page = expenseRepository.findAll(spec, pageable);
        Set<UUID> catIds = page.stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        Map<UUID, Category> catMap = catIds.isEmpty() ? Map.of()
            : categoryRepository.findAllById(catIds).stream().collect(Collectors.toMap(Category::getId, c -> c));
        return page.map(expenseMapper::toResponse).map(r -> enrichWithMap(r, catMap));
    }

    private void checkBudgetBreach(UUID userId, UUID familyId, UUID categoryId, LocalDate expenseDate) {
        if (categoryId == null) return;
        LocalDate date = expenseDate != null ? expenseDate : LocalDate.now();
        int year = date.getYear(), month = date.getMonthValue();
        // Family-shared budgets aggregate spend across every member — check those (family-scoped)
        // instead of the acting user's own budgets whenever the expense belongs to a family.
        List<Budget> budgets = familyId != null
                ? budgetRepository.findByFamilyIdAndCategoryId(familyId, categoryId)
                : budgetRepository.findByUserIdAndCategoryId(userId, categoryId);
        for (Budget budget : budgets) {
            try {
                BigDecimal spent;
                if (budget.getBudgetType() == BudgetType.YEARLY) {
                    spent = familyId != null
                            ? expenseRepository.sumByFamilyCategoryAndYear(familyId, categoryId, year)
                            : expenseRepository.sumByUserCategoryAndYear(userId, categoryId, year);
                } else {
                    spent = familyId != null
                            ? expenseRepository.sumByFamilyCategoryAndMonth(familyId, categoryId, year, month)
                            : expenseRepository.sumByUserCategoryAndMonth(userId, categoryId, year, month);
                }
                if (spent == null) spent = BigDecimal.ZERO;
                if (budget.getAmount().compareTo(BigDecimal.ZERO) == 0) continue;
                double pct = spent.divide(budget.getAmount(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).doubleValue();
                BigDecimal threshold = budget.getAlertThreshold() != null
                        ? budget.getAlertThreshold() : BigDecimal.valueOf(80);
                if (pct >= threshold.doubleValue()) {
                    String catName = categoryRepository.findById(categoryId)
                            .map(Category::getName).orElse("Unknown");
                    notificationService.createBudgetBreachNotification(
                            userId, catName, budget.getBudgetType().name(), spent, budget.getAmount(), pct);
                }
            } catch (Exception e) {
                log.warn("Budget breach check failed for user={} category={}: {}", userId, categoryId, e.getMessage());
            }
        }
    }

    private Expense findAndValidateOwner(UUID expenseId, UUID userId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", "id", expenseId));
        if (!expense.getUserId().equals(userId)) throw new AccessDeniedException();
        return expense;
    }

    private ExpenseResponse enrich(ExpenseResponse r) {
        return categoryRepository.findById(r.getCategoryId()).map(cat ->
            buildResponse(r, cat)
        ).orElse(r);
    }

    private ExpenseResponse enrichWithMap(ExpenseResponse r, Map<UUID, Category> catMap) {
        Category cat = catMap.get(r.getCategoryId());
        return cat != null ? buildResponse(r, cat) : r;
    }

    private ExpenseResponse buildResponse(ExpenseResponse r, Category cat) {
        return ExpenseResponse.builder()
            .id(r.getId()).userId(r.getUserId()).familyId(r.getFamilyId())
            .categoryId(r.getCategoryId()).budgetId(r.getBudgetId()).accountId(r.getAccountId())
            .categoryName(cat.getName()).categoryIcon(cat.getIcon()).categoryColor(cat.getColor())
            .amount(r.getAmount()).currency(r.getCurrency())
            .description(r.getDescription()).notes(r.getNotes())
            .expenseDate(r.getExpenseDate()).recurring(r.isRecurring())
            .recurrenceRule(r.getRecurrenceRule()).paymentMethod(r.getPaymentMethod())
            .createdAt(r.getCreatedAt()).build();
    }
}
