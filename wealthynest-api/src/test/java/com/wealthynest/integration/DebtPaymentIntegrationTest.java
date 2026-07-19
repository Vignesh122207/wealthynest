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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises DebtServiceImpl.recordPayment over the real HTTP/security/DB stack: a partial
 * payment on a BORROWED debt should debit the linked wallet account via a real AccountTransfer
 * row and leave the debt PARTIAL, and paying off the remainder should flip it to SETTLED. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class DebtPaymentIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("paying down a BORROWED debt creates a real debit transfer on the linked account and updates the debt's settled amount/status")
    void debtPaymentCreatesTransferAndUpdatesBalance() throws Exception {
        String email = "debt-payment-" + UUID.randomUUID() + "@example.com";
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository, email, "Passw0rd1");

        MvcResult accountResult = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"Salary Account","openingBalance":50000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(accountResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        MvcResult debtResult = mockMvc.perform(post("/api/v1/debts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"type":"BORROWED","accountId":"%s","contactName":"Rahul","amount":10000}
                                """.formatted(accountId)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode debtData = objectMapper.readTree(debtResult.getResponse().getContentAsString()).get("data");
        UUID debtId = UUID.fromString(debtData.get("id").asText());
        assertThat(debtData.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(debtData.get("amountRemaining").asDouble()).isEqualTo(10000.0);

        // Partial payment of 4000 — debt should move to PARTIAL, not SETTLED.
        MvcResult partialResult = mockMvc.perform(post("/api/v1/debts/" + debtId + "/payments")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"amount":4000,"note":"First installment"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode partialData = objectMapper.readTree(partialResult.getResponse().getContentAsString()).get("data");
        assertThat(partialData.get("status").asText()).isEqualTo("PARTIAL");
        assertThat(partialData.get("amountSettled").asDouble()).isEqualTo(4000.0);
        assertThat(partialData.get("amountRemaining").asDouble()).isEqualTo(6000.0);

        // Two transfers exist by now: the original borrowing (created alongside the debt itself)
        // and this repayment — the payment must have debited the linked account via the latter.
        MvcResult transfersResult = mockMvc.perform(get("/api/v1/accounts/transfers")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode transfers = objectMapper.readTree(transfersResult.getResponse().getContentAsString()).get("data");
        assertThat(transfers).hasSize(2);
        JsonNode repaymentTransfer = null;
        for (JsonNode t : transfers) {
            if ("REPAID".equals(t.get("debtLabel").asText())) repaymentTransfer = t;
        }
        assertThat(repaymentTransfer).as("repayment transfer").isNotNull();
        assertThat(repaymentTransfer.get("fromAccountId").asText()).isEqualTo(accountId.toString());
        assertThat(repaymentTransfer.get("toAccountId").isNull()).isTrue();
        assertThat(repaymentTransfer.get("amount").asDouble()).isEqualTo(4000.0);
        assertThat(repaymentTransfer.get("debt").asBoolean()).isTrue();
        assertThat(repaymentTransfer.get("debtContactName").asText()).isEqualTo("Rahul");

        // The account's live balance reflects both transfers: the 10000 borrowed in when the
        // debt was created, minus the 4000 just repaid out (50000 + 10000 - 4000 = 56000).
        MvcResult accountsAfter = mockMvc.perform(get("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode accounts = objectMapper.readTree(accountsAfter.getResponse().getContentAsString()).get("data");
        assertThat(accounts.get(0).get("currentBalance").asDouble()).isEqualTo(56000.0);

        // Pay the remaining 6000 — debt should settle exactly, no overpayment allowed beyond it.
        MvcResult finalResult = mockMvc.perform(post("/api/v1/debts/" + debtId + "/payments")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"amount":6000,"note":"Final installment"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode finalData = objectMapper.readTree(finalResult.getResponse().getContentAsString()).get("data");
        assertThat(finalData.get("status").asText()).isEqualTo("SETTLED");
        assertThat(finalData.get("amountRemaining").asDouble()).isEqualTo(0.0);

        // A settled debt rejects further payments — DebtServiceImpl guards this with a bare
        // IllegalStateException, which GlobalExceptionHandler has no specific mapping for and so
        // falls through to the generic 500 handler rather than a real 409/400; asserting the
        // actual (not ideal) behavior here rather than silently masking it.
        mockMvc.perform(post("/api/v1/debts/" + debtId + "/payments")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"amount":100}
                                """))
                .andExpect(status().isInternalServerError());
    }

    @Test
    @DisplayName("a payment larger than the remaining balance is rejected with 400, not silently overpaid")
    void overpaymentIsRejected() throws Exception {
        String email = "debt-overpay-" + UUID.randomUUID() + "@example.com";
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository, email, "Passw0rd1");

        MvcResult debtResult = mockMvc.perform(post("/api/v1/debts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"type":"LENT","contactName":"Priya","amount":2000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID debtId = UUID.fromString(objectMapper.readTree(debtResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        mockMvc.perform(post("/api/v1/debts/" + debtId + "/payments")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"amount":5000}
                                """))
                .andExpect(status().isBadRequest());
    }
}
