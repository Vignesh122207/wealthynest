package com.wealthynest.domain.asset.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import com.wealthynest.domain.asset.service.AssetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assetService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AssetResponse>> create(@Valid @RequestBody CreateAssetRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                assetService.createAsset(SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null), request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AssetResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
                assetService.getAssets(SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null))));
    }

    @GetMapping("/net-worth")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<BigDecimal>> getNetWorth() {
        return ResponseEntity.ok(ApiResponse.success(
                assetService.getTotalNetWorth(SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null))));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<AssetResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody CreateAssetRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                assetService.updateAsset(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        assetService.deleteAsset(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
