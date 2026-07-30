package com.wealthynest.domain.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.security.RefreshCookieService;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.user.dto.request.ChangePasswordRequest;
import com.wealthynest.domain.user.dto.request.UpdateProfileRequest;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.service.UserService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import jakarta.servlet.http.Cookie;
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

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
@ActiveProfiles("test")
class UserControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private UserService userService;
    @MockitoBean private AuthService authService;

    private final UUID userId = UUID.randomUUID();

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    @Test
    @DisplayName("an unauthenticated request is rejected before the service is called")
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());

        org.mockito.Mockito.verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("GET /me delegates the authenticated userId")
    void getProfileDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        when(userService.getProfile(userId)).thenReturn(UserResponse.builder().id(userId).build());

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(userId.toString()));
    }

    @Nested
    @DisplayName("request validation")
    class ValidationTests {

        @Test
        @DisplayName("a fullName shorter than 2 chars fails @Size validation")
        void tooShortFullNameFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(patch("/api/v1/users/me")
                            .contentType("application/json")
                            .content("""
                                    {"fullName": "A"}
                                    """))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.fullName").exists());
        }

        @Test
        @DisplayName("a weak new password fails @Pattern validation before the service is called")
        void weakNewPasswordFailsValidation() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            ChangePasswordRequest req = new ChangePasswordRequest();
            ReflectionTestUtils.setField(req, "currentPassword", "OldPass1");
            ReflectionTestUtils.setField(req, "newPassword", "alllowercase");

            mockMvc.perform(post("/api/v1/users/me/change-password")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.newPassword").exists());

            verify(userService, never()).changePassword(any(), any(), any(), any());
        }
    }

    @Test
    @DisplayName("DELETE /me delegates the authenticated userId to closeAccount")
    void closeAccountDelegatesUserId() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(delete("/api/v1/users/me"))
                .andExpect(status().isOk());

        verify(userService).closeAccount(userId);
    }

    @Test
    @DisplayName("POST /me/pin/disable delegates to authService, not userService")
    void disablePinDelegatesToAuthService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(post("/api/v1/users/me/pin/disable")
                        .contentType("application/json")
                        .content("""
                                {"pin": "1234"}
                                """))
                .andExpect(status().isOk());

        verify(authService).disablePin(eq(userId), any(), any(), any());
        org.mockito.Mockito.verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("POST /me/pin/disable with a blank pin fails @NotBlank validation before the service is called")
    void disablePinBlankPinFailsValidation() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);

        mockMvc.perform(post("/api/v1/users/me/pin/disable")
                        .contentType("application/json")
                        .content("""
                                {"pin": ""}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.fieldErrors.pin").exists());

        verify(authService, never()).disablePin(any(), any(), any(), any());
    }

    @Test
    @DisplayName("PATCH /me passes valid updates through to the service")
    void updateProfileDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        UpdateProfileRequest req = new UpdateProfileRequest();
        ReflectionTestUtils.setField(req, "fullName", "New Name");
        when(userService.updateProfile(eq(userId), any())).thenReturn(UserResponse.builder().id(userId).fullName("New Name").build());

        mockMvc.perform(patch("/api/v1/users/me")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("New Name"));
    }

    @Test
    @DisplayName("POST /me/change-password with a valid request delegates userId + client metadata to the service")
    void changePasswordDelegatesToService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        ChangePasswordRequest req = new ChangePasswordRequest();
        ReflectionTestUtils.setField(req, "currentPassword", "OldPass1");
        ReflectionTestUtils.setField(req, "newPassword", "NewPass123");

        mockMvc.perform(post("/api/v1/users/me/change-password")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(userService).changePassword(eq(userId), any(ChangePasswordRequest.class), any(), any());
    }

    @Test
    @DisplayName("POST /me/change-email delegates to authService, not userService")
    void changeEmailDelegatesToAuthService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        com.wealthynest.domain.auth.dto.request.ChangeEmailRequest req =
                new com.wealthynest.domain.auth.dto.request.ChangeEmailRequest();
        ReflectionTestUtils.setField(req, "newEmail", "new@example.com");
        ReflectionTestUtils.setField(req, "currentPassword", "CurrentPass1");

        mockMvc.perform(post("/api/v1/users/me/change-email")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(authService).changeEmail(eq(userId), any(), any(), any());
        org.mockito.Mockito.verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("POST /me/pin/enable with a valid PIN delegates to authService")
    void enablePinDelegatesToAuthService() throws Exception {
        SecurityTestUtils.authenticateAs(userId, null);
        com.wealthynest.domain.auth.dto.request.EnablePinRequest req =
                new com.wealthynest.domain.auth.dto.request.EnablePinRequest();
        ReflectionTestUtils.setField(req, "pin", "1234");

        mockMvc.perform(post("/api/v1/users/me/pin/enable")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(authService).enablePin(eq(userId), any());
    }

    @Nested
    @DisplayName("sessions")
    class SessionsTests {

        @Test
        @DisplayName("POST /me/sessions with no cookie still succeeds, passing a null current token")
        void listSessionsWithoutCookiePassesNullCurrentToken() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(authService.listSessions(eq(userId), isNull())).thenReturn(java.util.List.of());

            mockMvc.perform(post("/api/v1/users/me/sessions"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray());

            verify(authService).listSessions(userId, null);
        }

        @Test
        @DisplayName("POST /me/sessions with a refresh-token cookie passes the current token through")
        void listSessionsWithCookiePassesCurrentToken() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            when(authService.listSessions(eq(userId), eq("my-refresh-token"))).thenReturn(java.util.List.of());

            mockMvc.perform(post("/api/v1/users/me/sessions")
                            .cookie(new Cookie(RefreshCookieService.COOKIE_NAME, "my-refresh-token")))
                    .andExpect(status().isOk());

            verify(authService).listSessions(userId, "my-refresh-token");
        }

        @Test
        @DisplayName("DELETE /me/sessions/{id} delegates the authenticated userId and session id")
        void revokeSessionDelegates() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);
            UUID sessionId = UUID.randomUUID();

            mockMvc.perform(delete("/api/v1/users/me/sessions/" + sessionId))
                    .andExpect(status().isOk());

            verify(authService).revokeSession(userId, sessionId);
        }

        @Test
        @DisplayName("POST /me/sessions/revoke-others requires a refresh-token cookie")
        void revokeOtherSessionsRequiresRefreshToken() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(post("/api/v1/users/me/sessions/revoke-others"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("INVALID_TOKEN"));

            verify(authService, never()).revokeOtherSessions(any(), any());
        }

        @Test
        @DisplayName("POST /me/sessions/revoke-others with a cookie delegates to the service")
        void revokeOtherSessionsDelegates() throws Exception {
            SecurityTestUtils.authenticateAs(userId, null);

            mockMvc.perform(post("/api/v1/users/me/sessions/revoke-others")
                            .cookie(new Cookie(RefreshCookieService.COOKIE_NAME, "my-refresh-token")))
                    .andExpect(status().isOk());

            verify(authService).revokeOtherSessions(userId, "my-refresh-token");
        }
    }
}
