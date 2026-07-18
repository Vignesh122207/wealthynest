package com.wealthynest.domain.vault.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.request.VaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemSecretResponse;
import com.wealthynest.domain.vault.service.VaultService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vault/items")
@RequiredArgsConstructor
public class VaultController {
    private final VaultService vaultService;

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultItemResponse>> create(@Valid @RequestBody VaultItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                vaultService.createItem(SecurityUtils.requireCurrentUserId(), request)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<VaultItemResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(vaultService.getItems(SecurityUtils.requireCurrentUserId())));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultItemResponse>> getOne(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(vaultService.getItem(id, SecurityUtils.requireCurrentUserId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultItemResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody VaultItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                vaultService.updateItem(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        vaultService.deleteItem(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PatchMapping("/{id}/favorite")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultItemResponse>> toggleFavorite(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                vaultService.toggleFavorite(id, SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping("/{id}/reveal")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultItemSecretResponse>> reveal(
            @PathVariable UUID id, @Valid @RequestBody RevealVaultItemRequest request, HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(vaultService.revealSecret(
                id, SecurityUtils.requireCurrentUserId(), request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"))));
    }
}
