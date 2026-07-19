package com.wealthynest.domain.casimport.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.casimport.dto.CasImportConfirmRequest;
import com.wealthynest.domain.casimport.dto.CasImportResultResponse;
import com.wealthynest.domain.casimport.dto.CasPreviewResponse;
import com.wealthynest.domain.casimport.service.CasImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cas-import")
@RequiredArgsConstructor
public class CasImportController {
    private final CasImportService casImportService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CasPreviewResponse>> preview(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "password", required = false) String password) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(casImportService.preview(file, password, userId)));
    }

    @PostMapping("/confirm")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CasImportResultResponse>> confirm(@Valid @RequestBody CasImportConfirmRequest request) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return ResponseEntity.ok(ApiResponse.success(casImportService.confirm(userId, request)));
    }
}
