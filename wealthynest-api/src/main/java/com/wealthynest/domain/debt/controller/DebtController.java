package com.wealthynest.domain.debt.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.debt.dto.request.CreateDebtRequest;
import com.wealthynest.domain.debt.dto.request.RecordPaymentRequest;
import com.wealthynest.domain.debt.dto.request.UpdateDebtRequest;
import com.wealthynest.domain.debt.dto.response.DebtRecordResponse;
import com.wealthynest.domain.debt.entity.DebtType;
import com.wealthynest.domain.debt.service.DebtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/debts")
@RequiredArgsConstructor
public class DebtController {

    private final DebtService debtService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<DebtRecordResponse>>> getAll(
            @RequestParam(required = false) DebtType type) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        List<DebtRecordResponse> result = type != null
                ? debtService.getByType(userId, type)
                : debtService.getAll(userId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DebtRecordResponse>> create(
            @Valid @RequestBody CreateDebtRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(
                        debtService.create(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DebtRecordResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateDebtRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                debtService.update(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DebtRecordResponse>> recordPayment(
            @PathVariable UUID id,
            @Valid @RequestBody RecordPaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                debtService.recordPayment(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}/payments/{paymentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DebtRecordResponse>> deletePayment(
            @PathVariable UUID id,
            @PathVariable UUID paymentId) {
        return ResponseEntity.ok(ApiResponse.success(
                debtService.deletePayment(id, paymentId, SecurityUtils.requireCurrentUserId())));
    }

    @PatchMapping("/{id}/settle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DebtRecordResponse>> settle(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                debtService.settle(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        debtService.delete(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
