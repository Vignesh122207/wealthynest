package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.scheduler.LowBalanceScheduler;
import com.wealthynest.infra.scheduler.SpendAnomalyScheduler;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the two sweep-style notification schedulers (LowBalanceScheduler,
 * SpendAnomalyScheduler) over the real HTTP/security/DB stack. Both are deliberately driven into
 * the scenario only the *sweep* catches — not the direct-trigger path already covered by
 * ExpenseBudgetNotificationIntegrationTest — matching each scheduler's own documented purpose. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class NotificationTriggerIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private LowBalanceScheduler lowBalanceScheduler;
    @Autowired private SpendAnomalyScheduler spendAnomalyScheduler;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("an account that drifted below its threshold via a later-set alert (no triggering expense/transfer) is only caught by the low-balance sweep")
    void lowBalanceSweepCatchesAccountsMissedByDirectTriggers() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "low-balance-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        // Opens already below what will become its threshold — no expense/transfer ever touches
        // it, so neither direct-trigger path (expense creation, transfer) ever runs the check.
        MvcResult accountResult = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"Checking","openingBalance":400}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(accountResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        // No notification yet — the threshold hasn't been set.
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data").isEmpty());

        // Setting the threshold via update doesn't itself trigger a balance check.
        mockMvc.perform(put("/api/v1/accounts/" + accountId)
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"Checking","openingBalance":400,"lowBalanceThreshold":500}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data").isEmpty());

        // The sweep catches it.
        lowBalanceScheduler.checkAllAccounts();

        MvcResult notificationsResult = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode notifications = objectMapper.readTree(notificationsResult.getResponse().getContentAsString()).get("data");
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).get("type").asText()).isEqualTo("LOW_BALANCE");
    }

    @Test
    @DisplayName("an expense far above a category's recent trailing average is flagged by the spend-anomaly sweep; the routine expenses that established the baseline are not")
    void spendAnomalySweepFlagsOutlierAgainstTrailingAverage() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "spend-anomaly-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        MvcResult accountResult = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"CASH_WALLET","name":"Wallet","openingBalance":1000000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(accountResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        String categoryName = "DiningOut" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"%s","type":"EXPENSE"}
                                """.formatted(categoryName)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID categoryId = UUID.fromString(objectMapper.readTree(categoryResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        // Five routine ~100 expenses establish the trailing-30-day baseline (MIN_SAMPLE_SIZE=5).
        for (int daysAgo = 10; daysAgo >= 6; daysAgo--) {
            mockMvc.perform(post("/api/v1/expenses")
                            .header("Authorization", auth(auth.accessToken()))
                            .contentType("application/json")
                            .content("""
                                    {"categoryId":"%s","accountId":"%s","amount":100,"expenseDate":"%s"}
                                    """.formatted(categoryId, accountId, LocalDate.now().minusDays(daysAgo))))
                    .andExpect(status().isCreated());
        }

        // A same-day 1000 expense is 10x the ~100 baseline average — well past the 3x multiplier.
        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","accountId":"%s","amount":1000,"expenseDate":"%s"}
                                """.formatted(categoryId, accountId, LocalDate.now())))
                .andExpect(status().isCreated());

        spendAnomalyScheduler.checkRecentExpenses();

        MvcResult notificationsResult = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode notifications = objectMapper.readTree(notificationsResult.getResponse().getContentAsString()).get("data");
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).get("type").asText()).isEqualTo("SPEND_ANOMALY");
        assertThat(notifications.get(0).get("message").asText()).contains(categoryName);

        // Running the sweep again doesn't re-flag the same expense a second time in one day
        // (createBudgetBreachNotification-style dedup: one alert per category per day).
        spendAnomalyScheduler.checkRecentExpenses();
        MvcResult notificationsAfterRerun = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(notificationsAfterRerun.getResponse().getContentAsString()).get("data")).hasSize(1);
    }
}
