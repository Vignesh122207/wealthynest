package com.wealthynest.common.util;

import com.wealthynest.config.RateLimitConfig.RateLimitProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientIpResolverTest {

    @Mock private HttpServletRequest request;

    private RateLimitProperties props;
    private ClientIpResolver resolver;

    @BeforeEach
    void setUp() {
        props = new RateLimitProperties();
        resolver = new ClientIpResolver(props);
        lenient().when(request.getRemoteAddr()).thenReturn("10.0.0.5");
        lenient().when(request.getHeader("CF-Connecting-IP")).thenReturn(null);
    }

    @Test
    @DisplayName("no trusted proxies configured -> returns the raw remoteAddr")
    void noTrustedProxies_returnsRemoteAddr() {
        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }

    @Test
    @DisplayName("remoteAddr is NOT a trusted proxy -> headers ignored, returns remoteAddr")
    void untrustedRemoteAddr_ignoresHeaders() {
        props.setTrustedProxies("10.0.0.99");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
        verify(request, never()).getHeader("X-Forwarded-For");
    }

    @Test
    @DisplayName("trusted proxy, no forwarding headers -> falls back to remoteAddr")
    void trustedProxyNoHeaders_fallsBackToRemoteAddr() {
        props.setTrustedProxies("10.0.0.5");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }

    @Test
    @DisplayName("trusted proxy -> uses the first X-Forwarded-For IP")
    void trustedProxy_usesFirstForwardedIp() {
        props.setTrustedProxies("10.0.0.5, 10.0.0.6");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.5");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("trusted proxy sends both CF-Connecting-IP and X-Forwarded-For -> CF-Connecting-IP wins")
    void bothHeadersPresent_prefersCfConnectingIp() {
        props.setTrustedProxies("10.0.0.5");
        when(request.getHeader("CF-Connecting-IP")).thenReturn("203.0.113.9");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("remoteAddr falls inside a trusted CIDR range -> uses CF-Connecting-IP")
    void trustedCidrRange_usesCfConnectingIp() {
        props.setTrustedProxies("172.19.0.0/16");
        when(request.getRemoteAddr()).thenReturn("172.19.4.7");
        when(request.getHeader("CF-Connecting-IP")).thenReturn("203.0.113.9");

        assertThat(resolver.resolve(request)).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("remoteAddr falls outside a trusted CIDR range -> headers ignored, uses remoteAddr")
    void untrustedCidrRange_ignoresHeaders() {
        props.setTrustedProxies("172.19.0.0/16");
        when(request.getRemoteAddr()).thenReturn("10.0.0.5");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }

    @Test
    @DisplayName("blank trusted-proxies config -> treated the same as unset")
    void blankTrustedProxies_treatedAsUnset() {
        props.setTrustedProxies("   ");

        assertThat(resolver.resolve(request)).isEqualTo("10.0.0.5");
    }
}
