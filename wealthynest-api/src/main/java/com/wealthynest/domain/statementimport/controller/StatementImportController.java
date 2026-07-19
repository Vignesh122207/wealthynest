package com.wealthynest.domain.statementimport.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.statementimport.dto.ColumnMapping;
import com.wealthynest.domain.statementimport.dto.StatementImportConfirmRequest;
import com.wealthynest.domain.statementimport.dto.StatementImportResultResponse;
import com.wealthynest.domain.statementimport.dto.StatementPreviewResponse;
import com.wealthynest.domain.statementimport.service.StatementImportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/statement-import")
@RequiredArgsConstructor
public class StatementImportController {
    private final StatementImportService statementImportService;

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<StatementPreviewResponse>> preview(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "mapping", required = false) ColumnMapping mapping,
            @RequestPart(value = "password", required = false) String password) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.ok(ApiResponse.success(statementImportService.preview(file, mapping, password, userId, familyId)));
    }

    @PostMapping("/confirm")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<StatementImportResultResponse>> confirm(@Valid @RequestBody StatementImportConfirmRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.ok(ApiResponse.success(statementImportService.confirm(userId, familyId, request)));
    }
}
