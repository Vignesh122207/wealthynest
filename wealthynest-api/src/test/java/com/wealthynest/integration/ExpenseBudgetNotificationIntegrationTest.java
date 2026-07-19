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

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the cross-domain flow the unit-level tests can't: creating an expense against a real
 * budget over the real HTTP/security/DB stack triggers ExpenseServiceImpl's checkBudgetBreach,
 * which persists a real notification a client would then fetch from /api/v1/notifications. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class ExpenseBudgetNotificationIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("an expense that pushes spend past a budget's alert threshold creates a fetchable BUDGET_ALERT notification")
    void expenseCreationBreachesBudgetAndCreatesNotification() throws Exception {
        String email = "budget-breach-" + UUID.randomUUID() + "@example.com";
        AuthResult auth = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository, email, "Passw0rd1");

        String categoryName = "GroceriesTest" + UUID.randomUUID().toString().substring(0, 6);
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

        MvcResult accountResult = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"CASH_WALLET","name":"Wallet","openingBalance":100000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID accountId = UUID.fromString(objectMapper.readTree(accountResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        // Budget of 1000 with a 50% alert threshold — a single 600 expense (60%) should breach it.
        mockMvc.perform(post("/api/v1/budgets")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","amount":1000,"alertThreshold":50}
                                """.formatted(categoryId)))
                .andExpect(status().isCreated());

        // Before the breaching expense: no budget-alert notification yet.
        mockMvc.perform(get("/api/v1/notifications").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data", org.hamcrest.Matchers.empty()));

        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","accountId":"%s","amount":600,"expenseDate":"%s"}
                                """.formatted(categoryId, accountId, LocalDate.now())))
                .andExpect(status().isCreated());

        MvcResult notificationsResult = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode notifications = objectMapper.readTree(notificationsResult.getResponse().getContentAsString()).get("data");
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).get("type").asText()).isEqualTo("BUDGET_ALERT");
        assertThat(notifications.get(0).get("title").asText()).contains(categoryName);
        assertThat(notifications.get(0).get("read").asBoolean()).isFalse();

        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(1));

        // A second expense the same day, still over threshold, is deduplicated — not a second alert.
        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", auth(auth.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","accountId":"%s","amount":100,"expenseDate":"%s"}
                                """.formatted(categoryId, accountId, LocalDate.now())))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(1));

        mockMvc.perform(post("/api/v1/notifications/mark-all-read").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/notifications/unread-count").header("Authorization", auth(auth.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(0));
    }
}
