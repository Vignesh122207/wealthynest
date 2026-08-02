package com.wealthynest.domain.auth.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.auth.dto.response.PasskeyResponse;
import com.wealthynest.domain.auth.service.WebAuthnService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Authenticated passkey management — registering a new passkey and listing/removing existing
 * ones. Login with an already-registered passkey is public and lives in AuthController instead
 * (see /api/v1/auth/webauthn/login/**), matching how password/PIN login are both public too. */
@RestController
@RequestMapping("/api/v1/users/me/webauthn")
@RequiredArgsConstructor
public class WebAuthnController {
    private final WebAuthnService webAuthnService;

    @PostMapping("/register/options")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> registrationOptions() {
        return ResponseEntity.ok(ApiResponse.success(
                webAuthnService.getRegistrationOptions(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping("/register/verify")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> registrationVerify(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        Map<String, Object> credential = (Map<String, Object>) body.get("credential");
        String nickname = (String) body.get("nickname");
        webAuthnService.verifyRegistration(SecurityUtils.requireCurrentUserId(), credential, nickname);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/passkeys")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<PasskeyResponse>>> passkeys() {
        return ResponseEntity.ok(ApiResponse.success(
                webAuthnService.listPasskeys(SecurityUtils.requireCurrentUserId())));
    }

    /** Challenge options for re-proving an already-authenticated session with a registered
     * passkey — consumed by Vault reveal/export as a step-up credential (see
     * VaultServiceImpl#requireStepUpPasskey). Verification itself isn't a separate endpoint here:
     * the resulting assertion rides along in the reveal/export request body, alongside the
     * password/PIN alternatives it sits next to. */
    @PostMapping("/step-up/options")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stepUpOptions() {
        return ResponseEntity.ok(ApiResponse.success(
                webAuthnService.getStepUpOptions(SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/passkeys/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deletePasskey(@PathVariable UUID id) {
        webAuthnService.deletePasskey(SecurityUtils.requireCurrentUserId(), id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
