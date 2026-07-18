package com.wealthynest.domain.family.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expense.service.ExpenseService;
import com.wealthynest.domain.family.dto.request.CreateFamilyRequest;
import com.wealthynest.domain.family.dto.request.JoinFamilyRequest;
import com.wealthynest.domain.family.dto.response.FamilyResponse;
import com.wealthynest.domain.family.service.FamilyService;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.networth.service.NetWorthService;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class FamilyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private FamilyService familyService;
    @MockBean private ExpenseService expenseService;
    @MockBean private NetWorthService netWorthService;
    @MockBean private IncomeRepository incomeRepository;
    @MockBean private ExpenseRepository expenseRepository;
    @MockBean private UserRepository userRepository;

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
}
