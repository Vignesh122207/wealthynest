package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import java.util.Map;

@Getter
public class WebAuthnLoginVerifyRequest {
    @NotBlank @Email
    private String email;

    /** The raw WebAuthn assertion response (id/rawId/response/type/clientExtensionResults) — kept
     * as an untyped map rather than a modeled DTO since WebAuthnServiceImpl already consumes it
     * that way internally (via the java-webauthn-server library's own JSON parsing); this DTO only
     * needs to guarantee the envelope fields, not the credential's internal shape. */
    @NotNull
    private Map<String, Object> credential;

    private boolean rememberMe;
}
