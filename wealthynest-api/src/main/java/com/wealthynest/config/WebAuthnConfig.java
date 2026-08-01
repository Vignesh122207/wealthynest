package com.wealthynest.config;

import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.converter.util.ObjectConverter;
import jakarta.annotation.PostConstruct;
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

    // The one host we know for certain is wrong here: it permanently redirects (308) to
    // www.wealthynest.in at the DNS/Vercel level — see capacitor.config.ts's server.url comment
    // for the same underlying redirect, which silently broke the native bridge the exact same way
    // this would silently break WebAuthn. A browser/WebView actually served from
    // www.wealthynest.in sends that as its origin, but this bean would configure the RP for the
    // bare host instead — every passkey registration/login would fail with a silent origin
    // mismatch, not a loud error, the same failure mode JwtProperties.validate() already guards
    // against for a bad JWT secret. Only checked when frontend-url is doing the deriving (an
    // explicit rp-id override is trusted as intentional) and only for this one known-bad literal,
    // so it can't false-positive on a real, correctly-configured domain or on local dev's
    // localhost.
    @PostConstruct
    public void validateRpId() {
        if (configuredRpId != null && !configuredRpId.isBlank()) return;
        if ("wealthynest.in".equals(deriveHostFromFrontendUrl())) {
            throw new IllegalStateException(
                    "FATAL: FRONTEND_URL is set to the bare 'wealthynest.in' domain, which permanently "
                            + "redirects (308) to www.wealthynest.in. WebAuthn's RP ID/origin would derive "
                            + "to the wrong host and every passkey registration/login would silently fail "
                            + "with an origin mismatch. Set FRONTEND_URL to https://www.wealthynest.in, or "
                            + "set WEBAUTHN_RP_ID explicitly to override.");
        }
    }

    public String getRpId() {
        if (configuredRpId != null && !configuredRpId.isBlank()) return configuredRpId;
        return deriveHostFromFrontendUrl();
    }

    private String deriveHostFromFrontendUrl() {
        try {
            String host = URI.create(frontendUrl).getHost();
            return host != null ? host : "localhost";
        } catch (Exception e) {
            log.warn("Could not derive WebAuthn RP ID from frontend-url '{}', falling back to localhost", frontendUrl);
            return "localhost";
        }
    }

    public String getRpName() { return rpName; }
    public String getOrigin() { return frontendUrl; }
}
