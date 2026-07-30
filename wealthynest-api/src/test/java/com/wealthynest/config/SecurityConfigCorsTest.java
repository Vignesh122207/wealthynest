package com.wealthynest.config;

import com.wealthynest.common.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class SecurityConfigCorsTest {

    @Mock private JwtAuthenticationFilter jwtAuthenticationFilter;
    @Mock private UserDetailsService userDetailsService;
    @Mock private PasswordEncoder passwordEncoder;

    private CorsConfigurationSource corsConfigurationSource() {
        CorsProperties corsProperties = new CorsProperties();
        corsProperties.setAllowedOrigins(List.of("https://www.wealthynest.in"));
        SecurityConfig securityConfig = new SecurityConfig(
                jwtAuthenticationFilter, userDetailsService, corsProperties, passwordEncoder);
        return securityConfig.corsConfigurationSource();
    }

    // Regression test: /actuator/health is outside /api/**, mounted at the domain root by nginx
    // (see post-deploy.spec.ts), but the admin System Health panel fetches it from the browser
    // like any other endpoint. Without a CORS registration covering it, Spring's CorsFilter
    // rejects the preflight with "Invalid CORS request" before authorizeHttpRequests' permitAll
    // on this exact path ever gets a chance to apply - confirmed live against production (a real
    // OPTIONS request came back 403 with no X-Request-Id, proving it never reached
    // JwtAuthenticationFilter, let alone the controller).
    @Test
    @org.junit.jupiter.api.DisplayName("registers a CORS config for /actuator/health, not just /api/**")
    void actuatorHealthHasCorsConfig() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/actuator/health");

        CorsConfiguration config = corsConfigurationSource().getCorsConfiguration(request);

        assertThat(config).isNotNull();
        assertThat(config.getAllowedOrigins()).contains("https://www.wealthynest.in");
        assertThat(config.getAllowedMethods()).contains("GET", "OPTIONS");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("still registers a CORS config for /api/** paths")
    void apiPathsStillHaveCorsConfig() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/auth/login");

        CorsConfiguration config = corsConfigurationSource().getCorsConfiguration(request);

        assertThat(config).isNotNull();
        assertThat(config.getAllowedOrigins()).contains("https://www.wealthynest.in");
    }

    @Test
    @org.junit.jupiter.api.DisplayName("an unrelated actuator endpoint outside the health/info allowlist has no CORS config")
    void otherActuatorEndpointsHaveNoCorsConfig() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/actuator/env");

        CorsConfiguration config = corsConfigurationSource().getCorsConfiguration(request);

        assertThat(config).isNull();
    }
}
