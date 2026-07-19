package com.wealthynest.domain.vault.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultHealthResponse;
import com.wealthynest.domain.vault.service.VaultService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/**
 * Vault endpoints that aren't scoped to a single item — kept out of {@link VaultController}
 * (hard-mapped to {@code /api/v1/vault/items}) rather than restructuring its 7 existing
 * item-route annotations to nest under a shared prefix.
 */
@RestController
@RequestMapping("/api/v1/vault")
@RequiredArgsConstructor
public class VaultUtilityController {
    private final VaultService vaultService;

    @GetMapping("/health")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<VaultHealthResponse>> health() {
        return ResponseEntity.ok(ApiResponse.success(
                vaultService.getHealthSummary(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping("/export")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> export(@Valid @RequestBody RevealVaultItemRequest request, HttpServletRequest httpRequest) {
        String csv = vaultService.exportCsv(SecurityUtils.requireCurrentUserId(), request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        String filename = "wealthynest-vault-export-" + LocalDate.now() + ".csv";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
