package com.wealthynest.domain.casimport.service;

import com.wealthynest.domain.casimport.dto.CasImportConfirmRequest;
import com.wealthynest.domain.casimport.dto.CasImportResultResponse;
import com.wealthynest.domain.casimport.dto.CasPreviewResponse;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

public interface CasImportService {
    CasPreviewResponse preview(MultipartFile file, String password, UUID userId);
    CasImportResultResponse confirm(UUID userId, CasImportConfirmRequest request);
}
