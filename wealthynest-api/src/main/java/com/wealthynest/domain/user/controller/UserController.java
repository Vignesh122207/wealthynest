package com.wealthynest.domain.user.controller;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.RefreshCookieService;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.auth.dto.request.ChangeEmailRequest;
import com.wealthynest.domain.auth.dto.request.DisablePinRequest;
import com.wealthynest.domain.auth.dto.request.EnablePinRequest;
import com.wealthynest.domain.auth.dto.response.SessionResponse;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.user.dto.request.ChangePasswordRequest;
import com.wealthynest.domain.user.dto.request.UpdateProfileRequest;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final AuthService authService;
    private final RefreshCookieService refreshCookieService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> getProfile() {
        return ResponseEntity.ok(ApiResponse.success(
                userService.getProfile(SecurityUtils.requireCurrentUserId())));
    }

    @PatchMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                userService.updateProfile(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PostMapping("/me/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request, HttpServletRequest httpRequest) {
        userService.changePassword(SecurityUtils.requireCurrentUserId(), request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // Starts an email change — the account's actual `email` only updates once the link sent to
    // the new address is clicked (see AuthController#verifyEmail), so a change never locks the
    // user out the way silently overwriting `email` here used to.
    @PostMapping("/me/change-email")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> changeEmail(
            @Valid @RequestBody ChangeEmailRequest request, HttpServletRequest httpRequest) {
        authService.changeEmail(SecurityUtils.requireCurrentUserId(), request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> closeAccount() {
        userService.closeAccount(SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/me/pin/enable")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> enablePin(@Valid @RequestBody EnablePinRequest request) {
        authService.enablePin(SecurityUtils.requireCurrentUserId(), request);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/me/pin/disable")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> disablePin(
            @Valid @RequestBody DisablePinRequest request, HttpServletRequest httpRequest) {
        authService.disablePin(SecurityUtils.requireCurrentUserId(), request,
                httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    // POST (not GET) kept for route stability even though there's no body anymore — "which row is
    // this device" now comes from the httpOnly refresh cookie riding along on the request itself,
    // not a client-supplied value. Missing/unrecognized cookie is fine here: the list still
    // returns, just with nothing flagged current.
    @PostMapping("/me/sessions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> listSessions(HttpServletRequest httpRequest) {
        String currentRefreshToken = refreshCookieService.read(httpRequest).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(
                authService.listSessions(SecurityUtils.requireCurrentUserId(), currentRefreshToken)));
    }

    @DeleteMapping("/me/sessions/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> revokeSession(@PathVariable UUID id) {
        authService.revokeSession(SecurityUtils.requireCurrentUserId(), id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/me/sessions/revoke-others")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> revokeOtherSessions(HttpServletRequest httpRequest) {
        // Required here (unlike listSessions above) — excluding nothing would be indistinguishable
        // from revoking everything, including the caller's own session.
        String currentRefreshToken = refreshCookieService.read(httpRequest)
                .orElseThrow(() -> new BusinessException("Invalid refresh token", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
        authService.revokeOtherSessions(SecurityUtils.requireCurrentUserId(), currentRefreshToken);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
