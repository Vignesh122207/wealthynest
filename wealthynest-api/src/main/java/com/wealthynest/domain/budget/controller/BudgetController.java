package com.wealthynest.domain.budget.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.request.UpdateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.service.BudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/budgets")
@RequiredArgsConstructor
public class BudgetController {
    private final BudgetService budgetService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<BudgetResponse>> createOrUpdate(@Valid @RequestBody CreateBudgetRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(budgetService.createOrUpdateBudget(userId, familyId, request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<BudgetResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateBudgetRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.ok(ApiResponse.success(budgetService.updateBudget(id, userId, familyId, request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<BudgetResponse>>> getBudgets(
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "0") int month) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        LocalDate now = LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(budgetService.getBudgets(
                userId, familyId,
                year  == 0 ? now.getYear()       : year,
                month == 0 ? now.getMonthValue()  : month)));
    }

    @GetMapping("/for-category")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<BudgetResponse>>> forCategory(
            @RequestParam UUID categoryId,
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "0") int month) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        LocalDate now = LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(budgetService.getBudgetsForCategory(
                userId, categoryId,
                year  == 0 ? now.getYear()       : year,
                month == 0 ? now.getMonthValue()  : month)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        budgetService.deleteBudget(id, userId, familyId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/copy")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Integer>> copyBudgets(
            @RequestParam(required = false) Integer fromYear,
            @RequestParam(required = false) Integer fromMonth,
            @RequestParam(required = false) Integer toYear,
            @RequestParam(required = false) Integer toMonth) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        LocalDate now = LocalDate.now();
        int fy = fromYear  != null ? fromYear  : (now.getMonthValue() == 1 ? now.getYear() - 1 : now.getYear());
        int fm = fromMonth != null ? fromMonth : (now.getMonthValue() == 1 ? 12 : now.getMonthValue() - 1);
        int ty = toYear    != null ? toYear    : now.getYear();
        int tm = toMonth   != null ? toMonth   : now.getMonthValue();
        int count = budgetService.copyBudgets(userId, familyId, fy, fm, ty, tm);
        return ResponseEntity.ok(ApiResponse.success(count));
    }
}
