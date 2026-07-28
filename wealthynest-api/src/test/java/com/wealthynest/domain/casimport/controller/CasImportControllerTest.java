package com.wealthynest.domain.casimport.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.casimport.dto.CasImportConfirmRequest;
import com.wealthynest.domain.casimport.dto.CasPreviewResponse;
import com.wealthynest.domain.casimport.service.CasImportService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CasImportController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class CasImportControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private CasImportService casImportService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated preview upload is rejected before the service is called")
    void unauthenticatedPreviewIsRejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "cas.pdf", "application/pdf", "dummy".getBytes());

        mockMvc.perform(multipart("/api/v1/cas-import/preview").file(file))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(casImportService);
    }

    @Test
    @DisplayName("POST /cas-import/preview delegates the uploaded file and authenticated userId")
    void previewDelegatesFileAndUser() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        MockMultipartFile file = new MockMultipartFile("file", "cas.pdf", "application/pdf", "dummy".getBytes());
        when(casImportService.preview(any(), any(), org.mockito.ArgumentMatchers.eq(userId)))
                .thenReturn(CasPreviewResponse.builder().needsPassword(false).holdings(List.of()).build());

        mockMvc.perform(multipart("/api/v1/cas-import/preview").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.needsPassword").value(false));
    }

    @Test
    @DisplayName("POST /cas-import/confirm with no rows fails @NotEmpty validation before the service is called")
    void confirmWithNoRowsFailsValidation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        CasImportConfirmRequest req = new CasImportConfirmRequest();
        req.setRows(List.of());

        mockMvc.perform(post("/api/v1/cas-import/confirm")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.rows").exists());

        org.mockito.Mockito.verifyNoInteractions(casImportService);
    }
}
