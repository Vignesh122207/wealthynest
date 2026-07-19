package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.scheduler.NetWorthSnapshotScheduler;
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

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises net-worth calculation across wallet accounts, manual assets, and manual liabilities
 * over the real HTTP/security/DB stack, then the monthly snapshot job (invoked directly, same as
 * the recurring-rule scheduler tests) that persists the computed figure for history charts. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class NetWorthSnapshotIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private NetWorthSnapshotScheduler snapshotScheduler;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("net worth = liquid balance + manual assets - manual/loan liabilities, and the monthly snapshot job persists that figure for history")
    void netWorthAggregatesAcrossAccountsAssetsAndLiabilitiesThenSnapshots() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "networth-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        // Liquid: a bank account with a 20000 opening balance.
        mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"Checking","openingBalance":20000}
                                """))
                .andExpect(status().isCreated());

        // A LOAN wallet account counts as a liability via its outstanding balance, not an asset.
        mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"LOAN","name":"Car Loan","openingBalance":80000,"bankName":"HDFC"}
                                """))
                .andExpect(status().isCreated());

        // A manual (non-investment) asset: real estate.
        mockMvc.perform(post("/api/v1/assets")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"Flat in Bangalore","assetType":"REAL_ESTATE","currentValue":500000}
                                """))
                .andExpect(status().isCreated());

        // A manual liability, separate from the LOAN wallet account above.
        mockMvc.perform(post("/api/v1/liabilities")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"Personal Loan from Friend","liabilityType":"PERSONAL_LOAN","principalAmount":50000,"outstandingAmount":50000}
                                """))
                .andExpect(status().isCreated());

        // totalAssets = 20000 (liquid) + 0 (investments) + 500000 (manual) = 520000
        // totalLiabilities = 50000 (manual) + 80000 (loan account) = 130000
        // totalNetWorth = 520000 - 130000 = 390000
        MvcResult summaryResult = mockMvc.perform(get("/api/v1/net-worth/summary")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode summary = objectMapper.readTree(summaryResult.getResponse().getContentAsString()).get("data");
        assertThat(summary.get("liquidBalance").asDouble()).isEqualTo(20000.0);
        assertThat(summary.get("manualAssetsValue").asDouble()).isEqualTo(500000.0);
        assertThat(summary.get("totalAssets").asDouble()).isEqualTo(520000.0);
        assertThat(summary.get("totalLiabilities").asDouble()).isEqualTo(130000.0);
        assertThat(summary.get("totalNetWorth").asDouble()).isEqualTo(390000.0);

        boolean hasRealEstate = false;
        for (JsonNode b : summary.get("assetBreakdown")) {
            if ("REAL_ESTATE".equals(b.get("assetType").asText())) {
                hasRealEstate = true;
                assertThat(b.get("totalValue").asDouble()).isEqualTo(500000.0);
            }
        }
        assertThat(hasRealEstate).as("REAL_ESTATE in asset breakdown").isTrue();

        boolean hasPersonalLoan = false;
        for (JsonNode b : summary.get("liabilityBreakdown")) {
            if ("PERSONAL_LOAN".equals(b.get("liabilityType").asText())) {
                hasPersonalLoan = true;
                assertThat(b.get("totalOutstanding").asDouble()).isEqualTo(50000.0);
            }
        }
        assertThat(hasPersonalLoan).as("PERSONAL_LOAN in liability breakdown").isTrue();

        // History is empty before any snapshot job has run.
        MvcResult historyBefore = mockMvc.perform(get("/api/v1/net-worth/history")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(historyBefore.getResponse().getContentAsString()).get("data")).isEmpty();

        // The scheduler snapshots *last* month's figure using the current summary — same job
        // JobSchedulerService/Admin trigger; called directly here since @Scheduled firing isn't
        // what's under test.
        snapshotScheduler.takeMonthlySnapshots();

        MvcResult historyAfter = mockMvc.perform(get("/api/v1/net-worth/history")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode history = objectMapper.readTree(historyAfter.getResponse().getContentAsString()).get("data");
        assertThat(history).hasSize(1);
        LocalDate lastMonth = LocalDate.now().minusMonths(1);
        assertThat(history.get(0).get("year").asInt()).isEqualTo(lastMonth.getYear());
        assertThat(history.get(0).get("month").asInt()).isEqualTo(lastMonth.getMonthValue());
        assertThat(history.get(0).get("netWorth").asDouble()).isEqualTo(390000.0);
    }
}
