package com.wealthynest.domain.expense.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.request.UpdateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/expenses")
@RequiredArgsConstructor
public class ExpenseController {
    private final ExpenseService expenseService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ExpenseResponse>> create(@Valid @RequestBody CreateExpenseRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(expenseService.createExpense(userId, familyId, request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<ExpenseResponse>> getAll(
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<UUID> accountIds,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) Boolean recurring,
            @RequestParam(defaultValue = "false")       boolean includeDebt,
            @RequestParam(defaultValue = "expenseDate") String sortBy,
            @RequestParam(defaultValue = "desc")        String sortDir,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {

        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);

        String field = "amount".equals(sortBy) ? "amount" : "expenseDate";
        Sort sort = "asc".equalsIgnoreCase(sortDir)
                ? Sort.by(field).ascending().and(Sort.by("createdAt").ascending())
                : Sort.by(field).descending().and(Sort.by("createdAt").descending());

        return ResponseEntity.ok(PagedResponse.of(expenseService.getExpenses(
                userId, familyId, categoryId, startDate, endDate, search,
                accountIds, minAmount, maxAmount, recurring, includeDebt,
                PageRequest.of(page, size, sort))));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ExpenseResponse>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                expenseService.getExpense(id, SecurityUtils.requireCurrentUserId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ExpenseResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateExpenseRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                expenseService.updateExpense(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        expenseService.deleteExpense(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
