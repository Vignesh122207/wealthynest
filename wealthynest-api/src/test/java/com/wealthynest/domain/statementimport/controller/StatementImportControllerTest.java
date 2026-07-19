package com.wealthynest.domain.statementimport.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.statementimport.dto.StatementImportConfirmRequest;
import com.wealthynest.domain.statementimport.dto.StatementPreviewResponse;
import com.wealthynest.domain.statementimport.service.StatementImportService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = StatementImportController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class StatementImportControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private StatementImportService statementImportService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated preview upload is rejected before the service is called")
    void unauthenticatedPreviewIsRejected() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "statement.csv", "text/csv", "date,amount\n".getBytes());

        mockMvc.perform(multipart("/api/v1/statement-import/preview").file(file))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(statementImportService);
    }

    @Test
    @DisplayName("POST /statement-import/preview delegates the uploaded file and authenticated userId")
    void previewDelegatesFileAndUser() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        MockMultipartFile file = new MockMultipartFile("file", "statement.csv", "text/csv", "date,amount\n".getBytes());
        when(statementImportService.preview(any(), any(), any(), org.mockito.ArgumentMatchers.eq(userId), any()))
                .thenReturn(StatementPreviewResponse.builder().build());

        mockMvc.perform(multipart("/api/v1/statement-import/preview").file(file))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /statement-import/confirm with no rows fails @NotEmpty validation")
    void confirmWithNoRowsFailsValidation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        StatementImportConfirmRequest req = new StatementImportConfirmRequest();
        ReflectionTestUtils.setField(req, "accountId", UUID.randomUUID());
        ReflectionTestUtils.setField(req, "rows", List.of());

        mockMvc.perform(post("/api/v1/statement-import/confirm")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.rows").exists());
    }

    @Test
    @DisplayName("POST /statement-import/confirm with a missing accountId fails @NotNull validation")
    void confirmWithoutAccountIdFailsValidation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(post("/api/v1/statement-import/confirm")
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.accountId").exists());

        org.mockito.Mockito.verifyNoInteractions(statementImportService);
    }
}
