package com.wealthynest.config;

import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.converter.util.ObjectConverter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;

@Slf4j
@Configuration
public class WebAuthnConfig {

    /** Explicit override — only needed if the relying-party domain must differ from
     * FRONTEND_URL's host (e.g. multiple frontends sharing one passkey scope). Left unset by
     * default so passkeys automatically follow whatever domain the app is actually served from,
     * rather than silently defaulting to "localhost" when this env var is forgotten. */
    @Value("${wealthynest.webauthn.rp-id:}")
    private String configuredRpId;

    @Value("${wealthynest.webauthn.rp-name:WealthyNest}")
    private String rpName;

    @Value("${wealthynest.mail.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Bean
    public ObjectConverter objectConverter() {
        return new ObjectConverter();
    }

    @Bean
    public WebAuthnManager webAuthnManager() {
        return WebAuthnManager.createNonStrictWebAuthnManager();
    }

    public String getRpId() {
        if (configuredRpId != null && !configuredRpId.isBlank()) return configuredRpId;
        try {
            return URI.create(frontendUrl).getHost();
        } catch (Exception e) {
            log.warn("Could not derive WebAuthn RP ID from frontend-url '{}', falling back to localhost", frontendUrl);
            return "localhost";
        }
    }

    public String getRpName() { return rpName; }
    public String getOrigin() { return frontendUrl; }
}
