package com.wealthynest.config;

import com.wealthynest.common.util.ClientIpResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private HttpServletRequest request;
    @Mock private HttpServletResponse response;
    @Mock private FilterChain chain;

    private RateLimitConfig.RateLimitProperties props;
    private RateLimitConfig.RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        props = new RateLimitConfig.RateLimitProperties();
        props.setAuthRequestsPerMinute(10);
        props.setApiRequestsPerMinute(200);
        // Real (not mocked) — ClientIpResolverTest covers its own logic in isolation; here it's
        // just wired through so this file's existing trusted-proxy/CIDR cases keep exercising the
        // real end-to-end resolution behavior through doFilter, same as before the extraction.
        filter = new RateLimitConfig.RateLimitFilter(props, redisTemplate, new ClientIpResolver(props));
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(request.getRemoteAddr()).thenReturn("10.0.0.5");
        // Every trusted-proxy test checks CF-Connecting-IP before X-Forwarded-For — default it to
        // absent here so tests that only care about the X-Forwarded-For fallback don't also need
        // to stub this.
        lenient().when(request.getHeader("CF-Connecting-IP")).thenReturn(null);
    }

    @Test
    @DisplayName("under the limit -> request passes through the chain, no 429")
    void underLimit_passesThrough() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("first request for a key -> sets a 1-minute expiry")
    void firstRequestForKey_setsExpiry() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(redisTemplate).expire(eq("ratelimit:api:10.0.0.5"), eq(java.time.Duration.ofMinutes(1)));
    }

    @Test
    @DisplayName("over the limit -> chain not invoked, 429 with the rate-limit JSON body")
    void overLimit_rejectsWithRateLimitBody() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(201L);
        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(any(), any());
        verify(response).setStatus(429);
        assertThat(sw.toString()).contains("RATE_LIMIT_EXCEEDED");
    }

    @Test
    @DisplayName("auth path -> uses the lower authRequestsPerMinute limit and the auth: key prefix")
    void authPath_usesAuthLimitAndKeyPrefix() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/auth/login");
        when(valueOperations.increment("ratelimit:auth:10.0.0.5")).thenReturn(11L);
        StringWriter sw = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(sw));

        filter.doFilter(request, response, chain);

        verify(response).setStatus(429);
    }

    @Test
    @DisplayName("Redis throws -> fails open, request still passes through the chain")
    void redisThrows_failsOpen() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment(anyString())).thenThrow(new RuntimeException("Redis down"));

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(response, never()).setStatus(anyInt());
    }

    @Test
    @DisplayName("no trusted proxies configured -> resolves client IP as the raw remoteAddr")
    void noTrustedProxies_usesRemoteAddr() throws Exception {
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:10.0.0.5");
        verify(request, never()).getHeader("X-Forwarded-For");
    }

    @Test
    @DisplayName("remoteAddr is a trusted proxy -> uses the first X-Forwarded-For IP instead")
    void trustedProxyWithForwardedFor_usesForwardedIp() throws Exception {
        props.setTrustedProxies("10.0.0.5, 10.0.0.6");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.5");
        when(valueOperations.increment("ratelimit:api:203.0.113.9")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:203.0.113.9");
    }

    @Test
    @DisplayName("remoteAddr is a trusted proxy but no X-Forwarded-For header -> falls back to remoteAddr")
    void trustedProxyNoForwardedHeader_fallsBackToRemoteAddr() throws Exception {
        props.setTrustedProxies("10.0.0.5");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(request.getHeader("X-Forwarded-For")).thenReturn(null);
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:10.0.0.5");
    }

    @Test
    @DisplayName("remoteAddr is NOT a trusted proxy -> X-Forwarded-For header is ignored")
    void untrustedRemoteAddr_ignoresForwardedHeader() throws Exception {
        props.setTrustedProxies("10.0.0.99");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:10.0.0.5");
        verify(request, never()).getHeader("X-Forwarded-For");
    }

    @Test
    @DisplayName("remoteAddr falls inside a trusted CIDR range -> uses CF-Connecting-IP")
    void trustedCidrRange_usesCfConnectingIp() throws Exception {
        props.setTrustedProxies("172.19.0.0/16");
        when(request.getRemoteAddr()).thenReturn("172.19.4.7");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(request.getHeader("CF-Connecting-IP")).thenReturn("203.0.113.9");
        when(valueOperations.increment("ratelimit:api:203.0.113.9")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:203.0.113.9");
    }

    @Test
    @DisplayName("remoteAddr falls outside a trusted CIDR range -> headers ignored, uses remoteAddr")
    void untrustedCidrRange_ignoresHeaders() throws Exception {
        props.setTrustedProxies("172.19.0.0/16");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(valueOperations.increment("ratelimit:api:10.0.0.5")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:10.0.0.5");
        verify(request, never()).getHeader("CF-Connecting-IP");
        verify(request, never()).getHeader("X-Forwarded-For");
    }

    @Test
    @DisplayName("trusted proxy sends both CF-Connecting-IP and X-Forwarded-For -> CF-Connecting-IP wins")
    void bothHeadersPresent_prefersCfConnectingIp() throws Exception {
        props.setTrustedProxies("10.0.0.5");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(request.getHeader("CF-Connecting-IP")).thenReturn("203.0.113.9");
        when(valueOperations.increment("ratelimit:api:203.0.113.9")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:203.0.113.9");
        verify(request, never()).getHeader("X-Forwarded-For");
    }

    @Test
    @DisplayName("trusted proxy, no CF-Connecting-IP -> falls back to X-Forwarded-For")
    void trustedProxyNoCfHeader_fallsBackToForwardedFor() throws Exception {
        props.setTrustedProxies("10.0.0.5");
        when(request.getRequestURI()).thenReturn("/api/v1/expenses");
        when(request.getHeader("X-Forwarded-For")).thenReturn("203.0.113.9, 10.0.0.5");
        when(valueOperations.increment("ratelimit:api:203.0.113.9")).thenReturn(1L);

        filter.doFilter(request, response, chain);

        verify(valueOperations).increment("ratelimit:api:203.0.113.9");
    }
}
