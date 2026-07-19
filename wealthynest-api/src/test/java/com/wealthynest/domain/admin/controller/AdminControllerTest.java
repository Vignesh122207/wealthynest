package com.wealthynest.domain.admin.controller;

import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
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

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
}
