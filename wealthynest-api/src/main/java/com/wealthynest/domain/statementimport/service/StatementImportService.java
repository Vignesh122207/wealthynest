package com.wealthynest.domain.statementimport.service;

import com.wealthynest.domain.statementimport.dto.ColumnMapping;
import com.wealthynest.domain.statementimport.dto.StatementImportConfirmRequest;
import com.wealthynest.domain.statementimport.dto.StatementImportResultResponse;
import com.wealthynest.domain.statementimport.dto.StatementPreviewResponse;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

public interface StatementImportService {
    StatementPreviewResponse preview(MultipartFile file, ColumnMapping mapping, String password, UUID userId, UUID familyId);
    StatementImportResultResponse confirm(UUID userId, UUID familyId, StatementImportConfirmRequest request);
}
