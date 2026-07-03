package com.wealthynest.domain.recurringincome.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.recurringincome.dto.request.CreateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.response.RecurringIncomeResponse;
import com.wealthynest.domain.recurringincome.service.RecurringIncomeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/recurring-income")
@RequiredArgsConstructor
public class RecurringIncomeController {

    private final RecurringIncomeService recurringIncomeService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<RecurringIncomeResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
                recurringIncomeService.getAll(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringIncomeResponse>> create(
            @Valid @RequestBody CreateRecurringIncomeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(
                        recurringIncomeService.create(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringIncomeResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRecurringIncomeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringIncomeService.update(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringIncomeResponse>> toggle(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringIncomeService.toggleActive(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        recurringIncomeService.delete(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
