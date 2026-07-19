package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
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

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises StatementImportServiceImpl's full CSV preview -> confirm flow over the real
 * HTTP/security/DB stack: a real multipart CSV upload is auto-detected and parsed into draft
 * rows, then confirmed into real Expense/Income rows fetchable from their own endpoints. Seeds
 * the system "Other" expense category directly via the repository since (unlike categories a
 * user creates through the API) no Flyway migration seeds one — confirm() requires it to exist
 * unconditionally as the categoryId fallback for any DEBIT row that doesn't set one explicitly. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class StatementImportIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private CategoryRepository categoryRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("a CSV bank statement is auto-detected on preview, and confirming its rows creates real expenses and income")
    void csvPreviewThenConfirmCreatesRealTransactions() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "stmt-import-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        // Seed the "Other" system fallback category the confirm() flow depends on unconditionally.
        categoryRepository.save(Category.builder().name("Other").type(CategoryType.EXPENSE).system(true).build());

        MvcResult accountResult = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"Checking","openingBalance":10000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(accountResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        String groceryCategoryName = "CsvGroceries" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"%s","type":"EXPENSE"}
                                """.formatted(groceryCategoryName)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID groceryCategoryId = UUID.fromString(objectMapper.readTree(categoryResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        String csv = """
                Date,Narration,Debit,Credit
                2026-06-01,%s purchase,450.00,0.00
                2026-06-02,Salary Credit,0.00,50000.00
                2026-06-03,Uber Ride,200.00,0.00
                """.formatted(groceryCategoryName);
        MockMultipartFile csvFile = new MockMultipartFile("file", "statement.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        MvcResult previewResult = mockMvc.perform(multipart("/api/v1/statement-import/preview")
                        .file(csvFile)
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode preview = objectMapper.readTree(previewResult.getResponse().getContentAsString()).get("data");
        assertThat(preview.get("needsMapping").asBoolean()).isFalse();
        JsonNode rows = preview.get("rows");
        assertThat(rows).hasSize(3);

        JsonNode row0 = rows.get(0);
        assertThat(row0.get("type").asText()).isEqualTo("DEBIT");
        assertThat(row0.get("amount").asDouble()).isEqualTo(450.0);
        assertThat(row0.get("valid").asBoolean()).isTrue();
        // The narration contains the category name, so category suggestion should have matched it.
        assertThat(row0.get("suggestedCategoryId").asText()).isEqualTo(groceryCategoryId.toString());

        JsonNode row1 = rows.get(1);
        assertThat(row1.get("type").asText()).isEqualTo("CREDIT");
        assertThat(row1.get("amount").asDouble()).isEqualTo(50000.0);
        // Credit rows never get an expense-category suggestion, regardless of narration content.
        assertThat(row1.get("suggestedCategoryId").isNull()).isTrue();

        JsonNode row2 = rows.get(2);
        assertThat(row2.get("type").asText()).isEqualTo("DEBIT");
        assertThat(row2.get("amount").asDouble()).isEqualTo(200.0);

        String confirmBody = """
                {"accountId":"%s","rows":[
                  {"date":"2026-06-01","description":"%s purchase","amount":450.00,"type":"DEBIT","categoryId":"%s"},
                  {"date":"2026-06-02","description":"Salary Credit","amount":50000.00,"type":"CREDIT"},
                  {"date":"2026-06-03","description":"Uber Ride","amount":200.00,"type":"DEBIT"}
                ]}
                """.formatted(accountId, groceryCategoryName, groceryCategoryId);

        MvcResult confirmResult = mockMvc.perform(post("/api/v1/statement-import/confirm")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content(confirmBody))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode confirmData = objectMapper.readTree(confirmResult.getResponse().getContentAsString()).get("data");
        assertThat(confirmData.get("created").asInt()).isEqualTo(3);
        assertThat(confirmData.get("failed").asInt()).isEqualTo(0);

        MvcResult expensesResult = mockMvc.perform(get("/api/v1/expenses")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode expensePage = objectMapper.readTree(expensesResult.getResponse().getContentAsString()).get("data");
        assertThat(expensePage).hasSize(2);

        MvcResult incomeResult = mockMvc.perform(get("/api/v1/income")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode incomePage = objectMapper.readTree(incomeResult.getResponse().getContentAsString()).get("data");
        assertThat(incomePage).hasSize(1);
        assertThat(incomePage.get(0).get("amount").asDouble()).isEqualTo(50000.0);
    }

    @Test
    @DisplayName("unrecognized CSV headers request manual column mapping instead of guessing wrong")
    void unrecognizedHeadersRequestManualMapping() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "stmt-import-mapping-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        String csv = "Col1,Col2,Col3\nfoo,bar,baz\n";
        MockMultipartFile csvFile = new MockMultipartFile("file", "statement.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        MvcResult result = mockMvc.perform(multipart("/api/v1/statement-import/preview")
                        .file(csvFile)
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = objectMapper.readTree(result.getResponse().getContentAsString()).get("data");
        assertThat(data.get("needsMapping").asBoolean()).isTrue();
        assertThat(data.get("headers")).hasSize(3);
    }
}
