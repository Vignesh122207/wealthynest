package com.wealthynest.domain.recurringtransfer.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.recurringtransfer.dto.request.CreateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.response.RecurringTransferResponse;
import com.wealthynest.domain.recurringtransfer.service.RecurringTransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/recurring-transfer")
@RequiredArgsConstructor
public class RecurringTransferController {

    private final RecurringTransferService recurringTransferService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<RecurringTransferResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
                recurringTransferService.getAll(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> create(
            @Valid @RequestBody CreateRecurringTransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(
                        recurringTransferService.create(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRecurringTransferRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringTransferService.update(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> toggle(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringTransferService.toggleActive(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        recurringTransferService.delete(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
