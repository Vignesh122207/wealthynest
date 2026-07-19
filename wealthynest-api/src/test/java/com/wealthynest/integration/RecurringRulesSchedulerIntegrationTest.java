package com.wealthynest.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.scheduler.RecurringGoalContributionScheduler;
import com.wealthynest.infra.scheduler.RecurringIncomeScheduler;
import com.wealthynest.infra.scheduler.RecurringTransferScheduler;
import com.wealthynest.testsupport.AbstractIntegrationTest;
import com.wealthynest.testsupport.IntegrationAuthHelper;
import com.wealthynest.testsupport.IntegrationAuthHelper.AuthResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the three "recurring rule -> daily scheduled job -> resulting record" flows over the
 * real HTTP/security/DB stack: a rule is created via its normal endpoint with dayOfMonth pinned to
 * today so the job is guaranteed to act on it, the scheduler bean is invoked directly (the same
 * method JobSchedulerService/Admin call — @Scheduled itself isn't under test here, just what the
 * job body does), and the resulting real record is fetched back over HTTP. Each job also runs a
 * second time in the same test to confirm the lastXMonth guard prevents double-processing within
 * the same month — the actual bug class these rules exist to prevent. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class RecurringRulesSchedulerIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private RecurringTransferScheduler transferScheduler;
    @Autowired private RecurringIncomeScheduler incomeScheduler;
    @Autowired private RecurringGoalContributionScheduler goalContributionScheduler;

    private String auth(String token) { return "Bearer " + token; }

    /** The schedulers call services that read SecurityContextHolder nowhere directly (they take
     * an explicit userId from the rule row), so no auth context is needed to invoke them — but
     * clearing it defensively after each run keeps this test isolated from MockMvc's per-request
     * context regardless. */
    private void clearSecurityContext() { SecurityContextHolder.clearContext(); }

    @Test
    @DisplayName("a recurring transfer rule due today is processed into a real AccountTransfer, and a same-month rerun does not double-transfer")
    void recurringTransferProcessedOnce() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "recurring-transfer-" + UUID.randomUUID() + "@example.com", "Passw0rd1");
        UUID fromAccountId = createAccount(auth, "Source Wallet", "5000");
        UUID toAccountId = createAccount(auth, "Savings", "0");

        mockMvc.perform(post("/api/v1/recurring-transfer")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"fromAccountId":"%s","toAccountId":"%s","amount":1000,"dayOfMonth":%d}
                                """.formatted(fromAccountId, toAccountId, LocalDate.now().getDayOfMonth())))
                .andExpect(status().isCreated());

        transferScheduler.processRecurringTransfers();
        clearSecurityContext();

        MvcResult transfersResult = mockMvc.perform(get("/api/v1/accounts/transfers")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode transfers = objectMapper.readTree(transfersResult.getResponse().getContentAsString()).get("data");
        assertThat(transfers).hasSize(1);
        assertThat(transfers.get(0).get("amount").asDouble()).isEqualTo(1000.0);
        assertThat(transfers.get(0).get("fromAccountId").asText()).isEqualTo(fromAccountId.toString());
        assertThat(transfers.get(0).get("toAccountId").asText()).isEqualTo(toAccountId.toString());

        // Running the same job again the same day/month must not create a second transfer.
        transferScheduler.processRecurringTransfers();
        clearSecurityContext();
        MvcResult transfersAfterRerun = mockMvc.perform(get("/api/v1/accounts/transfers")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode transfersAfter = objectMapper.readTree(transfersAfterRerun.getResponse().getContentAsString()).get("data");
        assertThat(transfersAfter).hasSize(1);
    }

    @Test
    @DisplayName("a recurring income rule due today is processed into a real Income row, and a same-month rerun does not double-credit")
    void recurringIncomeProcessedOnce() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "recurring-income-" + UUID.randomUUID() + "@example.com", "Passw0rd1");
        UUID accountId = createAccount(auth, "Salary Account", "0");

        mockMvc.perform(post("/api/v1/recurring-income")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountId":"%s","source":"SALARY","amount":75000,"dayOfMonth":%d}
                                """.formatted(accountId, LocalDate.now().getDayOfMonth())))
                .andExpect(status().isCreated());

        incomeScheduler.processRecurringIncome();
        clearSecurityContext();

        MvcResult incomeResult = mockMvc.perform(get("/api/v1/income")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode incomeRows = objectMapper.readTree(incomeResult.getResponse().getContentAsString()).get("data");
        assertThat(incomeRows).hasSize(1);
        assertThat(incomeRows.get(0).get("amount").asDouble()).isEqualTo(75000.0);
        assertThat(incomeRows.get(0).get("source").asText()).isEqualTo("SALARY");

        incomeScheduler.processRecurringIncome();
        clearSecurityContext();
        MvcResult incomeAfterRerun = mockMvc.perform(get("/api/v1/income")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(incomeAfterRerun.getResponse().getContentAsString()).get("data")).hasSize(1);
    }

    @Test
    @DisplayName("a recurring goal contribution rule due today bumps the goal's saved amount, capped at target, and a same-month rerun does not double-contribute")
    void recurringGoalContributionProcessedOnceAndCapsAtTarget() throws Exception {
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "recurring-goal-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        MvcResult goalResult = mockMvc.perform(post("/api/v1/goals")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"Emergency Fund","targetAmount":10000,"savedAmount":9500}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID goalId = UUID.fromString(objectMapper.readTree(goalResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        // A 1000 contribution against a goal 500 short of its target should cap at the target, not overshoot.
        mockMvc.perform(post("/api/v1/recurring-goal-contribution")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"goalId":"%s","amount":1000,"dayOfMonth":%d}
                                """.formatted(goalId, LocalDate.now().getDayOfMonth())))
                .andExpect(status().isCreated());

        goalContributionScheduler.processRecurringGoalContributions();
        clearSecurityContext();

        MvcResult goalsResult = mockMvc.perform(get("/api/v1/goals")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode goals = objectMapper.readTree(goalsResult.getResponse().getContentAsString()).get("data");
        JsonNode goal = null;
        for (JsonNode g : goals) if (g.get("id").asText().equals(goalId.toString())) goal = g;
        assertThat(goal).as("goal").isNotNull();
        assertThat(goal.get("savedAmount").asDouble()).isEqualTo(10000.0);

        goalContributionScheduler.processRecurringGoalContributions();
        clearSecurityContext();
        MvcResult goalsAfterRerun = mockMvc.perform(get("/api/v1/goals")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode goalsAfter = objectMapper.readTree(goalsAfterRerun.getResponse().getContentAsString()).get("data");
        JsonNode goalAfter = null;
        for (JsonNode g : goalsAfter) if (g.get("id").asText().equals(goalId.toString())) goalAfter = g;
        assertThat(goalAfter.get("savedAmount").asDouble()).isEqualTo(10000.0);
    }

    private UUID createAccount(AuthResult auth, String name, String openingBalance) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"BANK_ACCOUNT","name":"%s","openingBalance":%s}
                                """.formatted(name, openingBalance)))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("data").get("id").asText());
    }
}
