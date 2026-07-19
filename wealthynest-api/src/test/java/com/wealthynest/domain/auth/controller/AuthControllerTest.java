package com.wealthynest.domain.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.config.RateLimitConfig;
import com.wealthynest.config.SecurityConfig;
import com.wealthynest.domain.auth.dto.request.LoginRequest;
import com.wealthynest.domain.auth.dto.request.RegisterRequest;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.auth.service.WebAuthnService;
import com.wealthynest.testsupport.SecurityTestConfig;
import com.wealthynest.testsupport.SecurityTestUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthController is entirely permitAll at the URL level (SecurityConfig's "/api/v1/auth/**"
 * matcher) with no @PreAuthorize — the interesting behavior here is password-policy validation,
 * and the exact HTTP status GlobalExceptionHandler maps BusinessException/BadCredentialsException
 * to, since those are the two failure modes AuthServiceImpl actually throws.
 */
@WebMvcTest(controllers = AuthController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = RateLimitConfig.RateLimitFilter.class))
@Import({SecurityConfig.class, SecurityTestConfig.class})
class AuthControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockitoBean private AuthService authService;
    @MockitoBean private WebAuthnService webAuthnService;

    @AfterEach
    void clearSecurityContext() {
        SecurityTestUtils.clearAuthentication();
    }

    private RegisterRequest validRegisterRequest() {
        RegisterRequest req = new RegisterRequest();
        ReflectionTestUtils.setField(req, "fullName", "Jane Doe");
        ReflectionTestUtils.setField(req, "email", "jane@example.com");
        ReflectionTestUtils.setField(req, "password", "Passw0rd1");
        return req;
    }

    private AuthResponse sampleAuthResponse() {
        return AuthResponse.builder().accessToken("access").refreshToken("refresh")
                .expiresIn(3600).tokenType("Bearer").build();
    }

    @Test
    @DisplayName("auth endpoints are reachable without an Authorization header (permitAll)")
    void registerIsReachableWithoutAuth() throws Exception {
        when(authService.register(any())).thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(validRegisterRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.accessToken").value("access"));
    }

    @Nested
    @DisplayName("password policy validation")
    class PasswordValidationTests {

        @Test
        @DisplayName("a password missing an uppercase/digit fails the @Pattern check with 422")
        void weakPasswordFailsPatternValidation() throws Exception {
            RegisterRequest req = validRegisterRequest();
            ReflectionTestUtils.setField(req, "password", "alllowercase");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.password").exists());
        }

        @Test
        @DisplayName("a password shorter than 8 characters fails @Size validation")
        void tooShortPasswordFailsValidation() throws Exception {
            RegisterRequest req = validRegisterRequest();
            ReflectionTestUtils.setField(req, "password", "Ab1");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.password").exists());
        }

        @Test
        @DisplayName("a malformed email fails @Email validation")
        void malformedEmailFailsValidation() throws Exception {
            RegisterRequest req = validRegisterRequest();
            ReflectionTestUtils.setField(req, "email", "not-an-email");

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.fieldErrors.email").exists());
        }
    }

    @Nested
    @DisplayName("error mapping for the two failure modes AuthServiceImpl actually throws")
    class ErrorMappingTests {

        @Test
        @DisplayName("registering a duplicate email maps BusinessException to its declared status/code")
        void duplicateEmailMapsToBusinessExceptionStatus() throws Exception {
            when(authService.register(any()))
                    .thenThrow(new BusinessException("Email already registered", HttpStatus.CONFLICT, "EMAIL_TAKEN"));

            mockMvc.perform(post("/api/v1/auth/register")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(validRegisterRequest())))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"));
        }

        @Test
        @DisplayName("wrong credentials on login map BadCredentialsException to 401 INVALID_CREDENTIALS")
        void wrongCredentialsMapTo401() throws Exception {
            LoginRequest req = new LoginRequest();
            ReflectionTestUtils.setField(req, "email", "jane@example.com");
            ReflectionTestUtils.setField(req, "password", "wrongpassword");
            when(authService.login(any(), any(), any())).thenThrow(new BadCredentialsException("bad creds"));

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"));
        }

        @Test
        @DisplayName("login with a missing password field returns 422 before the service is ever called")
        void missingPasswordFailsValidationBeforeServiceCall() throws Exception {
            LoginRequest req = new LoginRequest();
            ReflectionTestUtils.setField(req, "email", "jane@example.com");

            mockMvc.perform(post("/api/v1/auth/login")
                            .contentType("application/json")
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isUnprocessableEntity());

            org.mockito.Mockito.verify(authService, org.mockito.Mockito.never()).login(any(), any(), any());
        }
    }

    @Test
    @DisplayName("an invalid resend-verification email param is rejected with a clean 422 before the service runs, " +
            "matching the @RequestBody validation shape (via GlobalExceptionHandler's HandlerMethodValidationException handler)")
    void resendVerificationQueryParamValidationReturns422() throws Exception {
        mockMvc.perform(post("/api/v1/auth/resend-verification").param("email", "not-an-email"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors.email").exists());

        org.mockito.Mockito.verify(authService, org.mockito.Mockito.never()).resendVerification(any());
    }

    @Test
    @DisplayName("login success returns 200 with the service's AuthResponse")
    void loginSuccessReturnsAuthResponse() throws Exception {
        LoginRequest req = new LoginRequest();
        ReflectionTestUtils.setField(req, "email", "jane@example.com");
        ReflectionTestUtils.setField(req, "password", "Passw0rd1");
        when(authService.login(any(), any(), any())).thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access"));
    }

    @Test
    @DisplayName("refresh delegates the request and returns the new AuthResponse")
    void refreshDelegatesToService() throws Exception {
        when(authService.refresh(any())).thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"some-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access"));
    }

    @Test
    @DisplayName("logout delegates the raw refresh token and client metadata to the service")
    void logoutDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"some-token\"}"))
                .andExpect(status().isOk());

        verify(authService).logout(eq("some-token"), any(), any());
    }

    @Test
    @DisplayName("forgotPassword delegates to the service and always returns 200 regardless of whether the email exists")
    void forgotPasswordDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType("application/json")
                        .content("{\"email\":\"jane@example.com\"}"))
                .andExpect(status().isOk());

        verify(authService).forgotPassword(any());
    }

    @Test
    @DisplayName("resetPassword delegates the request and client metadata to the service")
    void resetPasswordDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType("application/json")
                        .content("{\"token\":\"raw-token\",\"newPassword\":\"NewPassw0rd1\"}"))
                .andExpect(status().isOk());

        verify(authService).resetPassword(any(), any(), any());
    }

    @Test
    @DisplayName("verifyEmail delegates the token query param and client metadata to the service")
    void verifyEmailDelegatesToService() throws Exception {
        mockMvc.perform(get("/api/v1/auth/verify-email").param("token", "raw-token"))
                .andExpect(status().isOk());

        verify(authService).verifyEmail(eq("raw-token"), any(), any());
    }

    @Test
    @DisplayName("resendVerification with a valid email delegates to the service")
    void resendVerificationSuccessDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/v1/auth/resend-verification").param("email", "jane@example.com"))
                .andExpect(status().isOk());

        verify(authService).resendVerification("jane@example.com");
    }

    @Test
    @DisplayName("googleLogin delegates the request and client metadata to the service")
    void googleLoginDelegatesToService() throws Exception {
        when(authService.googleLogin(any(), any(), any())).thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/google-login")
                        .contentType("application/json")
                        .content("{\"idToken\":\"raw-id-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access"));
    }

    @Test
    @DisplayName("pinLogin delegates the request and client metadata to the service")
    void pinLoginDelegatesToService() throws Exception {
        when(authService.pinLogin(any(), any(), any())).thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/pin-login")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"some-token\",\"pin\":\"1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access"));
    }

    @Test
    @DisplayName("webAuthnLoginOptions delegates the email to WebAuthnService")
    void webAuthnLoginOptionsDelegatesToService() throws Exception {
        when(webAuthnService.getAuthenticationOptions("jane@example.com"))
                .thenReturn(Map.of("challenge", "abc123"));

        mockMvc.perform(post("/api/v1/auth/webauthn/login/options")
                        .contentType("application/json")
                        .content("{\"email\":\"jane@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.challenge").value("abc123"));
    }

    @Test
    @DisplayName("webAuthnLoginVerify extracts email/credential/rememberMe from the raw body and delegates to WebAuthnService")
    void webAuthnLoginVerifyDelegatesToService() throws Exception {
        when(webAuthnService.verifyAuthentication(eq("jane@example.com"), any(), eq(true), any(), any()))
                .thenReturn(sampleAuthResponse());

        mockMvc.perform(post("/api/v1/auth/webauthn/login/verify")
                        .contentType("application/json")
                        .content("{\"email\":\"jane@example.com\",\"rememberMe\":true,\"credential\":{\"id\":\"cred-1\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access"));

        verify(webAuthnService).verifyAuthentication(eq("jane@example.com"), any(), eq(true), any(), any());
    }
}
