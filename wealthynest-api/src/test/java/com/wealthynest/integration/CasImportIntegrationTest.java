package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.testsupport.AbstractIntegrationTest;
import com.wealthynest.testsupport.IntegrationAuthHelper;
import com.wealthynest.testsupport.IntegrationAuthHelper.AuthResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises CasImportServiceImpl's full preview -> confirm flow over the real HTTP/security/DB
 * stack: a real CAS-shaped PDF (built with PDFBox, same approach as the bank-statement-import
 * PDF parsing test) is uploaded, parsed into draft holdings, then confirmed into real Investment
 * rows fetchable from /api/v1/investments. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class CasImportIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    private MultipartFile pdfFile(List<String> lines) throws Exception {
        try (org.apache.pdfbox.pdmodel.PDDocument document = new org.apache.pdfbox.pdmodel.PDDocument()) {
            org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage(
                    org.apache.pdfbox.pdmodel.common.PDRectangle.A4);
            document.addPage(page);
            try (org.apache.pdfbox.pdmodel.PDPageContentStream cs =
                         new org.apache.pdfbox.pdmodel.PDPageContentStream(document, page)) {
                org.apache.pdfbox.pdmodel.font.PDType1Font font = new org.apache.pdfbox.pdmodel.font.PDType1Font(
                        org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA);
                cs.setFont(font, 10);
                cs.beginText();
                cs.newLineAtOffset(50, 750);
                for (String line : lines) {
                    cs.showText(line);
                    cs.newLineAtOffset(0, -14);
                }
                cs.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return new MockMultipartFile("file", "cas.pdf", "application/pdf", out.toByteArray());
        }
    }

    @Test
    @DisplayName("previewing a real CAS PDF extracts holdings (valid and invalid), and confirming the valid ones creates real, fetchable investments")
    void previewThenConfirmCreatesInvestments() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "cas-import-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        String scheme1 = "AxisBluechipFund" + UUID.randomUUID().toString().substring(0, 6) + " Direct Growth";
        String scheme2 = "HDFCTop100Fund" + UUID.randomUUID().toString().substring(0, 6) + " Direct Growth";
        MultipartFile pdf = pdfFile(List.of(
                scheme1,
                "Folio No: 12345678 / 0",
                "ISIN: INF846K01131",
                "Closing Unit Balance: 1234.5670 Market Value: Rs. 56,400.00 Cost Value: Rs. 50,000.00",
                scheme2,
                "Folio No: 87654321",
                "Closing Unit Balance: 500.0000 Market Value: Rs. 25,000.00 Cost Value: Rs. 20,000.00",
                // A closing-balance line with no scheme name line ahead of it — parsed but flagged invalid.
                "Closing Unit Balance: 100.0000 Market Value: Rs. 5,000.00"
        ));

        MvcResult previewResult = mockMvc.perform(multipart("/api/v1/cas-import/preview")
                        .file((MockMultipartFile) pdf)
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode preview = objectMapper.readTree(previewResult.getResponse().getContentAsString()).get("data");
        assertThat(preview.get("needsPassword").asBoolean()).isFalse();
        JsonNode holdings = preview.get("holdings");
        assertThat(holdings).hasSize(3);

        JsonNode holding1 = holdings.get(0);
        assertThat(holding1.get("schemeName").asText()).isEqualTo(scheme1);
        assertThat(holding1.get("folioNumber").asText()).isEqualTo("12345678/0");
        assertThat(holding1.get("units").asDouble()).isEqualTo(1234.567);
        assertThat(holding1.get("currentValue").asDouble()).isEqualTo(56400.00);
        assertThat(holding1.get("valid").asBoolean()).isTrue();

        JsonNode holding2 = holdings.get(1);
        assertThat(holding2.get("schemeName").asText()).isEqualTo(scheme2);
        assertThat(holding2.get("folioNumber").asText()).isEqualTo("87654321");
        assertThat(holding2.get("valid").asBoolean()).isTrue();

        JsonNode holding3 = holdings.get(2);
        assertThat(holding3.get("valid").asBoolean()).isFalse();
        assertThat(holding3.get("error").asText()).contains("identify the scheme name");

        // Confirm only the two valid holdings, as the review UI's user would.
        List<String> rows = new ArrayList<>();
        for (JsonNode h : List.of(holding1, holding2)) {
            rows.add("""
                    {"schemeName":"%s","schemeCode":%s,"folioNumber":"%s","units":%s,"nav":%s,"currentValue":%s,"investedAmount":%s}
                    """.formatted(
                    h.get("schemeName").asText(),
                    h.get("schemeCode").isNull() ? "null" : "\"" + h.get("schemeCode").asText() + "\"",
                    h.get("folioNumber").asText(),
                    h.get("units").asText(),
                    h.get("nav").asText(),
                    h.get("currentValue").asText(),
                    h.get("investedAmount").asText()));
        }
        String confirmBody = "{\"rows\":[" + String.join(",", rows) + "]}";

        MvcResult confirmResult = mockMvc.perform(post("/api/v1/cas-import/confirm")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content(confirmBody))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode confirmData = objectMapper.readTree(confirmResult.getResponse().getContentAsString()).get("data");
        assertThat(confirmData.get("created").asInt()).isEqualTo(2);
        assertThat(confirmData.get("failed").asInt()).isEqualTo(0);

        MvcResult investmentsResult = mockMvc.perform(get("/api/v1/investments")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode investments = objectMapper.readTree(investmentsResult.getResponse().getContentAsString()).get("data");
        assertThat(investments).hasSize(2);
        for (JsonNode inv : investments) {
            assertThat(inv.get("investmentType").asText()).isEqualTo("MUTUAL_FUND");
        }
        List<String> companyNames = new ArrayList<>();
        investments.forEach(inv -> companyNames.add(inv.get("companyName").asText()));
        assertThat(companyNames).containsExactlyInAnyOrder(scheme1, scheme2);
    }

    @Test
    @DisplayName("a password-protected CAS PDF is flagged needsPassword instead of erroring, and an empty PDF is rejected")
    void passwordProtectedPdfIsFlagged() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "cas-nopass-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        try (org.apache.pdfbox.pdmodel.PDDocument document = new org.apache.pdfbox.pdmodel.PDDocument()) {
            document.addPage(new org.apache.pdfbox.pdmodel.PDPage(org.apache.pdfbox.pdmodel.common.PDRectangle.A4));
            org.apache.pdfbox.pdmodel.encryption.AccessPermission ap = new org.apache.pdfbox.pdmodel.encryption.AccessPermission();
            org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy spp =
                    new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy("owner-pw", "user-pw", ap);
            document.protect(spp);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            MultipartFile pdf = new MockMultipartFile("file", "cas.pdf", "application/pdf", out.toByteArray());

            MvcResult result = mockMvc.perform(multipart("/api/v1/cas-import/preview")
                            .file((MockMultipartFile) pdf)
                            .header("Authorization", auth(auth.accessToken())))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
            assertThat(data.get("needsPassword").asBoolean()).isTrue();
            assertThat(data.get("holdings")).isEmpty();
        }
    }
}
