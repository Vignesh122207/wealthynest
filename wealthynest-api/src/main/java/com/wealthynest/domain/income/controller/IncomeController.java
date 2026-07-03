package com.wealthynest.domain.income.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.dto.request.UpdateIncomeRequest;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import com.wealthynest.domain.income.service.IncomeService;
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
@RequestMapping("/api/v1/income")
@RequiredArgsConstructor
public class IncomeController {
    private final IncomeService incomeService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<IncomeResponse>> create(@Valid @RequestBody CreateIncomeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(incomeService.create(SecurityUtils.requireCurrentUserId(), request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<IncomeResponse>>> get(
            @RequestParam(defaultValue = "0")     int year,
            @RequestParam(defaultValue = "0")     int month,
            @RequestParam(defaultValue = "false") boolean includeDebt) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        LocalDate now = LocalDate.now();
        if (year == 0 && month == 0) {
            return ResponseEntity.ok(ApiResponse.success(incomeService.getAll(userId, includeDebt)));
        }
        if (year != 0 && month == 0) {
            return ResponseEntity.ok(ApiResponse.success(incomeService.getByYear(userId, year)));
        }
        return ResponseEntity.ok(ApiResponse.success(incomeService.getByPeriod(
                userId,
                year  == 0 ? now.getYear()      : year,
                month == 0 ? now.getMonthValue() : month,
                includeDebt)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<IncomeResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateIncomeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                incomeService.update(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        incomeService.delete(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
