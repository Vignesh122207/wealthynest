package com.wealthynest.domain.expensesplit.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.expensesplit.dto.request.AddSplitsRequest;
import com.wealthynest.domain.expensesplit.dto.response.ExpenseSplitResponse;
import com.wealthynest.domain.expensesplit.dto.response.MySplitsResponse;
import com.wealthynest.domain.expensesplit.service.ExpenseSplitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/expense-splits")
@RequiredArgsConstructor
public class ExpenseSplitController {
    private final ExpenseSplitService expenseSplitService;

    @GetMapping("/my-splits")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MySplitsResponse>> mySplits() {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.getMySplits(userId)));
    }

    @PostMapping("/{id}/settle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> settle(@PathVariable UUID id) {
        expenseSplitService.settleSplit(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/settle-with/{counterpartId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> settleWith(@PathVariable UUID counterpartId) {
        expenseSplitService.settleWithCounterpart(SecurityUtils.requireCurrentUserId(), counterpartId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/expense/{expenseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<ExpenseSplitResponse>>> getForExpense(@PathVariable UUID expenseId) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.getSplitsForExpense(expenseId, userId)));
    }

    @PostMapping("/expense/{expenseId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> addForExpense(@PathVariable UUID expenseId, @Valid @RequestBody AddSplitsRequest request) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        expenseSplitService.addSplits(expenseId, userId, request.getSplitWith());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(null));
    }
}
