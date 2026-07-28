package com.wealthynest.domain.family.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expense.service.ExpenseService;
import com.wealthynest.domain.family.dto.request.CreateFamilyRequest;
import com.wealthynest.domain.family.dto.request.JoinFamilyRequest;
import com.wealthynest.domain.family.dto.request.RenameFamilyRequest;
import com.wealthynest.domain.family.dto.request.TransferAdminRequest;
import com.wealthynest.domain.family.dto.response.FamilyMemberResponse;
import com.wealthynest.domain.family.dto.response.FamilyResponse;
import com.wealthynest.domain.family.service.FamilyService;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.networth.service.NetWorthService;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FamilyController's read endpoints (members, expenses, net-worth, monthly-stats) all gate
 * access through familyService.getFamily(userId, familyId) as an inline membership check before
 * doing anything else — a non-member calling any of them should be rejected the same way calling
 * getFamily directly would be. Also injects three repositories directly (not just services), so
 * this test verifies @WebMvcTest can mock those alongside the service beans.
 */
@WebMvcTest(controllers = FamilyController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class FamilyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private FamilyService familyService;
    @MockitoBean private ExpenseService expenseService;
    @MockitoBean private NetWorthService netWorthService;
    @MockitoBean private IncomeRepository incomeRepository;
    @MockitoBean private ExpenseRepository expenseRepository;
    @MockitoBean private UserRepository userRepository;

    private final UUID userId = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("creating a family with a blank name fails @NotBlank validation")
        void blankNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            CreateFamilyRequest req = new CreateFamilyRequest();
            ReflectionTestUtils.setField(req, "name", "");

            mockMvc.perform(post("/api/v1/families")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.name").exists());
        }

        @Test
        @DisplayName("joining with a blank invite code fails @NotBlank validation")
        void blankInviteCodeFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            JoinFamilyRequest req = new JoinFamilyRequest();
            ReflectionTestUtils.setField(req, "inviteCode", "");

            mockMvc.perform(post("/api/v1/families/join")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.inviteCode").exists());
        }
    }

    @Nested
    @DisplayName("membership-check gating on read endpoints")
    class MembershipCheckTests {

        @Test
        @DisplayName("a non-member calling getFamily is rejected with 403 FORBIDDEN via the custom AccessDeniedException mapping")
        void nonMemberGetFamilyIsForbidden() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(familyService.getFamily(userId, familyId))
                    .thenThrow(new AccessDeniedException("Not a member of this family"));

            mockMvc.perform(get("/api/v1/families/{familyId}", familyId))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        }

        @Test
        @DisplayName("getFamilyNetWorth performs the membership check before calling netWorthService — a non-member never reaches it")
        void nonMemberNetWorthNeverReachesNetWorthService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(familyService.getFamily(userId, familyId))
                    .thenThrow(new AccessDeniedException("Not a member of this family"));

            mockMvc.perform(get("/api/v1/families/{familyId}/net-worth", familyId))
                    .andExpect(status().isForbidden());

            org.mockito.Mockito.verifyNoInteractions(netWorthService);
        }

        @Test
        @DisplayName("a genuine member reaches getFamilyNetWorth and gets the service's value")
        void memberReachesNetWorthService() throws Exception {
            SecurityTestUtils.authenticateAs(userId, familyId);
            when(familyService.getFamily(userId, familyId)).thenReturn(
                    FamilyResponse.builder().id(familyId).name("The Smiths").build());
            when(netWorthService.getFamilyNetWorth(familyId)).thenReturn(new java.math.BigDecimal("150000"));

            mockMvc.perform(get("/api/v1/families/{familyId}/net-worth", familyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").value(150000));
        }
    }

    @Test
    @DisplayName("createFamily uses the authenticated userId, and the response echoes the service's data")
    void createFamilyDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        CreateFamilyRequest req = new CreateFamilyRequest();
        ReflectionTestUtils.setField(req, "name", "The Smiths");
        when(familyService.createFamily(eq(userId), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(FamilyResponse.builder().id(familyId).name("The Smiths").inviteCode("ABC123").build());

        mockMvc.perform(post("/api/v1/families")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.inviteCode").value("ABC123"));
    }

    @Test
    @DisplayName("getMembers returns the family's member list")
    void getMembersReturnsList() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(familyService.getMembers(userId, familyId)).thenReturn(
                List.of(FamilyMemberResponse.builder().id(userId).fullName("Alex").role("ADMIN").build()));

        mockMvc.perform(get("/api/v1/families/{familyId}/members", familyId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fullName").value("Alex"));
    }

    @Test
    @DisplayName("renameFamily delegates the authenticated userId and new name")
    void renameFamilyDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        RenameFamilyRequest req = new RenameFamilyRequest();
        ReflectionTestUtils.setField(req, "name", "New Name");
        when(familyService.renameFamily(eq(familyId), eq(userId), any()))
                .thenReturn(FamilyResponse.builder().id(familyId).name("New Name").build());

        mockMvc.perform(put("/api/v1/families/{familyId}", familyId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("New Name"));
    }

    @Test
    @DisplayName("renameFamily with a blank name fails @NotBlank validation")
    void renameFamilyBlankNameFailsValidation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        RenameFamilyRequest req = new RenameFamilyRequest();
        ReflectionTestUtils.setField(req, "name", "");

        mockMvc.perform(put("/api/v1/families/{familyId}", familyId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    @DisplayName("removeMember delegates familyId, actor and target memberId")
    void removeMemberDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        UUID memberId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/families/{familyId}/members/{memberId}", familyId, memberId))
                .andExpect(status().isOk());

        verify(familyService).removeMember(familyId, userId, memberId);
    }

    @Test
    @DisplayName("leaveFamily delegates the authenticated userId")
    void leaveFamilyDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);

        mockMvc.perform(post("/api/v1/families/leave"))
                .andExpect(status().isOk());

        verify(familyService).leaveFamily(userId);
    }

    @Test
    @DisplayName("deleteFamily delegates familyId and the authenticated userId")
    void deleteFamilyDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);

        mockMvc.perform(delete("/api/v1/families/{familyId}", familyId))
                .andExpect(status().isOk());

        verify(familyService).deleteFamily(eq(familyId), eq(userId), any(), any());
    }

    @Test
    @DisplayName("revokeAdmin delegates familyId, actor and target admin id")
    void revokeAdminDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        UUID targetId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/families/{familyId}/admin/{targetId}", familyId, targetId))
                .andExpect(status().isOk());

        verify(familyService).revokeAdmin(eq(familyId), eq(userId), eq(targetId), any(), any());
    }

    @Test
    @DisplayName("transferAdmin delegates the new admin id from the request body")
    void transferAdminDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        UUID newAdminId = UUID.randomUUID();
        TransferAdminRequest req = new TransferAdminRequest();
        ReflectionTestUtils.setField(req, "newAdminId", newAdminId);

        mockMvc.perform(post("/api/v1/families/{familyId}/transfer-admin", familyId)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(familyService).transferAdmin(eq(familyId), eq(userId), eq(newAdminId), any(), any());
    }

    @Test
    @DisplayName("getFamilyExpenses performs the membership check then returns the paged expenses")
    void getFamilyExpensesReturnsPagedResult() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        when(familyService.getFamily(userId, familyId)).thenReturn(
                FamilyResponse.builder().id(familyId).name("The Smiths").build());
        when(expenseService.getFamilyExpenses(eq(familyId), any(), any(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());

        mockMvc.perform(get("/api/v1/families/{familyId}/expenses", familyId))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("a non-member calling getFamilyExpenses never reaches expenseService")
    void nonMemberFamilyExpensesNeverReachesService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(familyService.getFamily(userId, familyId))
                .thenThrow(new AccessDeniedException("Not a member of this family"));

        mockMvc.perform(get("/api/v1/families/{familyId}/expenses", familyId))
                .andExpect(status().isForbidden());

        org.mockito.Mockito.verifyNoInteractions(expenseService);
    }

    @Test
    @DisplayName("getMonthlyStats aggregates income/expense across every family member and picks the highest spender")
    void getMonthlyStatsAggregatesAcrossMembers() throws Exception {
        SecurityTestUtils.authenticateAs(userId, familyId);
        UUID member2Id = UUID.randomUUID();
        User m1 = User.builder().fullName("Alex").build();
        ReflectionTestUtils.setField(m1, "id", userId);
        User m2 = User.builder().fullName("Sam").build();
        ReflectionTestUtils.setField(m2, "id", member2Id);
        when(familyService.getFamily(userId, familyId)).thenReturn(
                FamilyResponse.builder().id(familyId).name("The Smiths").build());
        when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(m1, m2));
        when(incomeRepository.sumByUserAndPeriod(userId, 2025, 1)).thenReturn(new BigDecimal("50000"));
        when(expenseRepository.sumByUserAndMonth(userId, 2025, 1)).thenReturn(new BigDecimal("10000"));
        when(incomeRepository.sumByUserAndPeriod(member2Id, 2025, 1)).thenReturn(null); // no income logged
        when(expenseRepository.sumByUserAndMonth(member2Id, 2025, 1)).thenReturn(new BigDecimal("20000"));

        mockMvc.perform(get("/api/v1/families/{familyId}/monthly-stats", familyId)
                        .param("year", "2025").param("month", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalIncome").value(50000))
                .andExpect(jsonPath("$.data.totalExpense").value(30000))
                .andExpect(jsonPath("$.data.savings").value(20000))
                .andExpect(jsonPath("$.data.highestSpenderName").value("Sam"))
                .andExpect(jsonPath("$.data.highestSpenderAmount").value(20000));
    }
}
