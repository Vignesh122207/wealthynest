package com.wealthynest.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebAuthnConfigTest {

    private WebAuthnConfig config(String rpId, String frontendUrl) {
        WebAuthnConfig config = new WebAuthnConfig();
        ReflectionTestUtils.setField(config, "configuredRpId", rpId);
        ReflectionTestUtils.setField(config, "frontendUrl", frontendUrl);
        return config;
    }

    @Test
    void derivesRpIdAndOriginFromFrontendUrlWhenNoOverrideIsSet() {
        WebAuthnConfig config = config("", "https://www.wealthynest.in");

        assertThat(config.getRpId()).isEqualTo("www.wealthynest.in");
        assertThat(config.getOrigin()).isEqualTo("https://www.wealthynest.in");
    }

    @Test
    void explicitRpIdOverrideWinsOverFrontendUrl() {
        WebAuthnConfig config = config("passkeys.wealthynest.in", "https://www.wealthynest.in");

        assertThat(config.getRpId()).isEqualTo("passkeys.wealthynest.in");
    }

    // Regression coverage for a real risk: wealthynest.in permanently redirects (308) to
    // www.wealthynest.in (see capacitor.config.ts's server.url comment for the same underlying
    // issue, which silently broke the native bridge the exact same way this would silently break
    // WebAuthn). A browser/WebView actually served from www.wealthynest.in sends that as its
    // origin, but frontend-url set to the bare host would configure the RP for the wrong one —
    // every passkey registration/login would fail with a silent origin mismatch. This must fail
    // loudly at startup instead, the same posture JwtProperties.validate() already takes for a bad
    // JWT secret.
    @Test
    void failsFastWhenFrontendUrlIsTheBareRedirectingDomain() {
        WebAuthnConfig config = config("", "https://wealthynest.in");

        assertThatThrownBy(config::validateRpId).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void doesNotFailFastWhenAnExplicitRpIdOverrideIsSetEvenIfFrontendUrlIsTheBareDomain() {
        WebAuthnConfig config = config("www.wealthynest.in", "https://wealthynest.in");

        config.validateRpId();
    }

    @Test
    void doesNotFailFastForTheCorrectWwwDomain() {
        WebAuthnConfig config = config("", "https://www.wealthynest.in");

        config.validateRpId();
    }

    @Test
    void doesNotFailFastForLocalDev() {
        WebAuthnConfig config = config("", "http://localhost:3000");

        config.validateRpId();
    }
}
