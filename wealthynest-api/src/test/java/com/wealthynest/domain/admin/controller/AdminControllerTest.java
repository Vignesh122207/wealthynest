package com.wealthynest.domain.admin.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.service.AdminService;
import com.wealthynest.domain.admin.service.JobSchedulerService;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AdminController is protected by role-based access (hasRole('ADMIN')) both at the URL level
 * (SecurityConfig's requestMatchers("/api/v1/admin/**")) and at the class level (@PreAuthorize on
 * the controller) — two independent enforcement points that both need to reject a non-admin.
 * This is the key case ExpenseControllerTest's "isAuthenticated()" tests don't cover: proving a
 * successfully authenticated but non-privileged user is still denied.
 */
@WebMvcTest(controllers = AdminController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class AdminControllerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private AdminService adminService;
    @MockitoBean private JobSchedulerService jobSchedulerService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request to an admin endpoint returns 401")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/admin/stats"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("an authenticated MEMBER (non-admin) is rejected with 403, not allowed through")
    void nonAdminMemberIsForbidden() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.MEMBER);

        mockMvc.perform(get("/api/v1/admin/stats"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("an authenticated FAMILY_ADMIN (not the platform ADMIN role) is still rejected with 403")
    void familyAdminRoleIsNotSufficient() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.FAMILY_ADMIN);

        mockMvc.perform(get("/api/v1/admin/stats"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("an authenticated ADMIN can reach the endpoint and receives the service's data")
    void adminRoleIsAllowedThrough() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        when(adminService.getStats()).thenReturn(Map.of("totalUsers", 42L));

        mockMvc.perform(get("/api/v1/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalUsers").value(42));
    }

    @Test
    @DisplayName("a non-UUID path variable on an admin sub-resource returns 400 INVALID_PARAMETER, not a 500 or an auth error")
    void invalidPathVariableStillReturns400ForAdmin() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/users/{id}/toggle-active", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_PARAMETER"));
    }

    @Test
    @DisplayName("calling a PATCH-only endpoint with GET returns 405 METHOD_NOT_ALLOWED, not a 500")
    void wrongHttpMethodReturns405NotInternalError() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);

        mockMvc.perform(get("/api/v1/admin/users/{id}/toggle-active", UUID.randomUUID()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    @DisplayName("toggleActive delegates the authenticated actor's id (not any client-supplied value) for the audit trail")
    void toggleActiveUsesAuthenticatedActorId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        UUID targetId = UUID.randomUUID();
        when(adminService.toggleActive(org.mockito.ArgumentMatchers.eq(targetId),
                org.mockito.ArgumentMatchers.eq(userId), any(), any()))
                .thenReturn(com.wealthynest.domain.user.dto.response.UserResponse.builder().id(targetId).build());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/users/{id}/toggle-active", targetId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(targetId.toString()));
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("listJobs returns the job scheduler's configs wrapped in ApiResponse")
    void listJobsReturnsConfigs() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        JobScheduleConfig cfg = JobScheduleConfig.builder()
                .jobName("AUTO_INCOME").displayName("Auto Income").cronExpression("0 0 2 * * *")
                .timezone("Asia/Kolkata").enabled(true).build();
        when(jobSchedulerService.getAllConfigs()).thenReturn(List.of(cfg));

        mockMvc.perform(get("/api/v1/admin/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].jobName").value("AUTO_INCOME"));
    }

    @Test
    @DisplayName("triggerJob delegates the path-variable job name to the scheduler and confirms success")
    void triggerJobDelegatesToScheduler() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);

        mockMvc.perform(post("/api/v1/admin/jobs/{jobName}/trigger", "AUTO_INCOME"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("Job AUTO_INCOME triggered successfully"));

        org.mockito.Mockito.verify(jobSchedulerService).triggerNow("AUTO_INCOME");
    }

    @Test
    @DisplayName("triggerJob for an unknown job returns a proper 404 NOT_FOUND")
    void triggerJobUnknownJobReturns404() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        doThrow(new com.wealthynest.common.exception.ResourceNotFoundException("Job", "name", "BOGUS"))
                .when(jobSchedulerService).triggerNow("BOGUS");

        mockMvc.perform(post("/api/v1/admin/jobs/{jobName}/trigger", "BOGUS"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("updateSchedule passes the jobName and cron query param through and returns the updated config")
    void updateScheduleDelegatesToScheduler() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        JobScheduleConfig updated = JobScheduleConfig.builder()
                .jobName("AUTO_INCOME").displayName("Auto Income").cronExpression("0 15 3 * * *")
                .timezone("Asia/Kolkata").enabled(true).build();
        when(jobSchedulerService.updateSchedule("AUTO_INCOME", "0 15 3 * * *")).thenReturn(updated);

        mockMvc.perform(put("/api/v1/admin/jobs/{jobName}/schedule", "AUTO_INCOME")
                        .param("cron", "0 15 3 * * *"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cronExpression").value("0 15 3 * * *"));
    }

    // ── Remaining admin endpoints ────────────────────────────────────────────

    @Test
    @DisplayName("getUserGrowth returns the admin service's growth series")
    void getUserGrowthReturnsSeries() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        when(adminService.getUserGrowth()).thenReturn(List.of(Map.of("month", "2025-01", "count", 5)));

        mockMvc.perform(get("/api/v1/admin/user-growth"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].count").value(5));
    }

    @Test
    @DisplayName("resetPassword returns a confirmation message including the target user's email")
    void resetPasswordReturnsConfirmation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        UUID targetId = UUID.randomUUID();
        when(adminService.resetPassword(eq(targetId), eq(userId), any(), any())).thenReturn("user@example.com");

        mockMvc.perform(post("/api/v1/admin/users/{id}/reset-password", targetId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("Password reset email sent to user@example.com"));
    }

    @Test
    @DisplayName("anonymizeUser delegates to the service and returns the anonymized user")
    void anonymizeUserDelegates() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        UUID targetId = UUID.randomUUID();
        when(adminService.anonymizeUser(eq(targetId), eq(userId), any(), any()))
                .thenReturn(com.wealthynest.domain.user.dto.response.UserResponse.builder().id(targetId).build());

        mockMvc.perform(post("/api/v1/admin/users/{id}/anonymize", targetId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(targetId.toString()));
    }

    @Test
    @DisplayName("listUsers builds a createdAt-descending pageable and returns the service's paged result")
    void listUsersReturnsPagedResult() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        var userResponse = com.wealthynest.domain.user.dto.response.UserResponse.builder()
                .id(UUID.randomUUID()).fullName("Alice").build();
        var page = new org.springframework.data.domain.PageImpl<>(List.of(userResponse));
        when(adminService.listUsers(any(), eq("alice"))).thenReturn(
                com.wealthynest.common.response.PagedResponse.of(page));

        mockMvc.perform(get("/api/v1/admin/users").param("search", "alice"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fullName").value("Alice"));
    }

    @Test
    @DisplayName("updateRole passes the target id, role query param, and authenticated actor id through")
    void updateRoleDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        UUID targetId = UUID.randomUUID();
        when(adminService.updateRole(eq(targetId), eq(UserRole.ADMIN), eq(userId), any(), any()))
                .thenReturn(com.wealthynest.domain.user.dto.response.UserResponse.builder()
                        .id(targetId).role(UserRole.ADMIN.name()).build());

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/users/{id}/role", targetId)
                        .param("role", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }

    @Test
    @DisplayName("getAuditLogs passes page/size/userId/action query params through and returns the service's paged result")
    void getAuditLogsReturnsPagedResult() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null, UserRole.ADMIN);
        UUID filterUserId = UUID.randomUUID();
        var logResponse = com.wealthynest.common.audit.AuditLogResponse.builder()
                .action("USER_ROLE_CHANGED").userEmail("alice@x.com").build();
        var page = new org.springframework.data.domain.PageImpl<>(List.of(logResponse));
        when(adminService.getAuditLogs(any(), eq(filterUserId), eq("USER_ROLE_CHANGED")))
                .thenReturn(com.wealthynest.common.response.PagedResponse.of(page));

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("userId", filterUserId.toString())
                        .param("action", "USER_ROLE_CHANGED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].userEmail").value("alice@x.com"));
    }
}
