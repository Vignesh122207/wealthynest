package com.wealthynest.domain.liability.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.service.LiabilityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/liabilities")
@RequiredArgsConstructor
public class LiabilityController {

    private final LiabilityService liabilityService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<LiabilityResponse>> create(
            @Valid @RequestBody CreateLiabilityRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                liabilityService.createLiability(
                        SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null),
                        request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<LiabilityResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
                liabilityService.getLiabilities(
                        SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null))));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<LiabilityResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreateLiabilityRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                liabilityService.updateLiability(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        liabilityService.deleteLiability(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
