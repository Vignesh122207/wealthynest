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

/** Exercises family creation -> invite -> join, then confirms membership is real (not JWT-cached:
 * UserPrincipal is rebuilt per-request from the DB, so a member sees family-scoped data without
 * re-logging in) by having one member create a category/budget and the other create the expense
 * that breaches it, then checking both members see the same shared, breached budget. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class FamilySharedBudgetIntegrationTest extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;

    private String auth(String token) { return "Bearer " + token; }

    @Test
    @DisplayName("a family member joining via invite code immediately sees, and can contribute spend to, budgets the creator set up")
    void familyInviteJoinAndSharedBudgetVisibility() throws Exception {
        AuthResult creator = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "family-creator-" + UUID.randomUUID() + "@example.com", "Passw0rd1");
        AuthResult joiner = IntegrationAuthHelper.registerVerifyAndLogin(mockMvc, objectMapper, userRepository,
                "family-joiner-" + UUID.randomUUID() + "@example.com", "Passw0rd1");

        // Before joining any family, the joiner has no family-scoped visibility of anything.
        MvcResult familyResult = mockMvc.perform(post("/api/v1/families")
                        .header("Authorization", auth(creator.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"The Test Family"}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode familyData = objectMapper.readTree(familyResult.getResponse().getContentAsString()).get("data");
        UUID familyId = UUID.fromString(familyData.get("id").asText());
        String inviteCode = familyData.get("inviteCode").asText();
        assertThat(inviteCode).isNotBlank();

        // The joiner can't see the family yet.
        mockMvc.perform(get("/api/v1/families/" + familyId).header("Authorization", auth(joiner.accessToken())))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/families/join")
                        .header("Authorization", auth(joiner.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"inviteCode":"%s"}
                                """.formatted(inviteCode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(familyId.toString()));

        MvcResult membersResult = mockMvc.perform(get("/api/v1/families/" + familyId + "/members")
                        .header("Authorization", auth(creator.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode members = objectMapper.readTree(membersResult.getResponse().getContentAsString()).get("data");
        assertThat(members).hasSize(2);

        // The creator sets up a category and a shared budget — no re-login needed anywhere,
        // UserPrincipal.familyId is loaded fresh from the DB on every request.
        String categoryName = "SharedGroceries" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult categoryResult = mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", auth(creator.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"name":"%s","type":"EXPENSE"}
                                """.formatted(categoryName)))
                .andExpect(status().isCreated())
                .andReturn();
        UUID categoryId = UUID.fromString(objectMapper.readTree(categoryResult.getResponse().getContentAsString())
                .get("data").get("id").asText());

        mockMvc.perform(post("/api/v1/budgets")
                        .header("Authorization", auth(creator.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","amount":1000,"alertThreshold":50}
                                """.formatted(categoryId)))
                .andExpect(status().isCreated());

        // The joiner independently sees the same shared budget, marked as shared.
        MvcResult joinerBudgets = mockMvc.perform(get("/api/v1/budgets")
                        .header("Authorization", auth(joiner.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode joinerBudgetList = objectMapper.readTree(joinerBudgets.getResponse().getContentAsString()).get("data");
        assertThat(joinerBudgetList).hasSize(1);
        assertThat(joinerBudgetList.get(0).get("shared").asBoolean()).isTrue();
        assertThat(joinerBudgetList.get(0).get("categoryId").asText()).isEqualTo(categoryId.toString());

        // The joiner needs their own account to spend against, but shares the family's category/budget.
        MvcResult joinerAccount = mockMvc.perform(post("/api/v1/accounts")
                        .header("Authorization", auth(joiner.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"accountType":"CASH_WALLET","name":"Joiner Wallet","openingBalance":50000}
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        UUID joinerAccountId = UUID.fromString(objectMapper.readTree(joinerAccount.getResponse().getContentAsString())
                .get("data").get("id").asText());

        mockMvc.perform(post("/api/v1/expenses")
                        .header("Authorization", auth(joiner.accessToken()))
                        .contentType("application/json")
                        .content("""
                                {"categoryId":"%s","accountId":"%s","amount":600,"expenseDate":"%s"}
                                """.formatted(categoryId, joinerAccountId, LocalDate.now())))
                .andExpect(status().isCreated());

        // The creator sees the family-aggregated spend from the joiner's expense on the shared budget.
        MvcResult creatorBudgetsAfter = mockMvc.perform(get("/api/v1/budgets")
                        .header("Authorization", auth(creator.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode creatorBudgetList = objectMapper.readTree(creatorBudgetsAfter.getResponse().getContentAsString()).get("data");
        assertThat(creatorBudgetList.get(0).get("spent").asDouble()).isEqualTo(600.0);
        assertThat(creatorBudgetList.get(0).get("alertTriggered").asBoolean()).isTrue();

        // checkBudgetBreach notifies the acting user who created the breaching expense (the
        // joiner), not the budget's owning creator — the creator sees no notification of their own.
        MvcResult joinerNotifications = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(joiner.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode joinerNotifs = objectMapper.readTree(joinerNotifications.getResponse().getContentAsString()).get("data");
        assertThat(joinerNotifs).hasSize(1);
        assertThat(joinerNotifs.get(0).get("type").asText()).isEqualTo("BUDGET_ALERT");

        MvcResult creatorNotifications = mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", auth(creator.accessToken())))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode creatorNotifs = objectMapper.readTree(creatorNotifications.getResponse().getContentAsString()).get("data");
        assertThat(creatorNotifs).isEmpty();
    }
}
