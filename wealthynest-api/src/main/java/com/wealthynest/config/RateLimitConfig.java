package com.wealthynest.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@Configuration
public class RateLimitConfig {

    @Bean
    @ConfigurationProperties(prefix = "wealthynest.security.rate-limit")
    public RateLimitProperties rateLimitProperties() {
        return new RateLimitProperties();
    }

    @Getter
    @Setter
    public static class RateLimitProperties {
        private int    authRequestsPerMinute = 10;
        private int    apiRequestsPerMinute  = 200;
        /** Comma-separated trusted proxy IPs (e.g. load balancer). Only these are allowed to set X-Forwarded-For. */
        private String trustedProxies        = "";
    }

    // Fixed 1-minute window counter kept in Redis so the limit is shared across
    // every instance in a horizontally-scaled deployment (previously an
    // in-memory bucket4j map, which meant each instance had its own separate
    // budget and the count reset on every restart/deploy).
    @Slf4j
    @Component
    @Order(1)
    @RequiredArgsConstructor
    public static class RateLimitFilter implements Filter {
        private final RateLimitProperties props;
        private final StringRedisTemplate redisTemplate;

        @Override
        public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                throws IOException, ServletException {
            HttpServletRequest  request  = (HttpServletRequest) req;
            HttpServletResponse response = (HttpServletResponse) res;
            String ip   = resolveClientIp(request);
            String path = request.getRequestURI();
            boolean isAuthPath = path.startsWith("/api/v1/auth/");

            int    limit = isAuthPath ? props.getAuthRequestsPerMinute() : props.getApiRequestsPerMinute();
            String key   = "ratelimit:" + (isAuthPath ? "auth:" : "api:") + ip;

            if (tryConsume(key, limit)) {
                chain.doFilter(req, res);
            } else {
                log.warn("Rate limit exceeded for IP: {} on path: {}", ip, path);
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write(
                    "{\"success\":false,\"status\":429,\"error\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please try again later.\"}");
            }
        }

        /**
         * Atomically increments the per-IP counter for the current 1-minute window
         * and sets its expiry the first time the key is created. Fails open (allows
         * the request through) if Redis itself is unreachable — rate limiting is a
         * defense-in-depth layer, not the only safeguard, so an outage here
         * shouldn't take down the whole API.
         */
        private boolean tryConsume(String key, int limit) {
            try {
                Long count = redisTemplate.opsForValue().increment(key);
                if (count != null && count == 1L) {
                    redisTemplate.expire(key, Duration.ofMinutes(1));
                }
                return count == null || count <= limit;
            } catch (Exception e) {
                log.warn("Rate limiter Redis error, failing open: {}", e.getMessage());
                return true;
            }
        }

        private String resolveClientIp(HttpServletRequest request) {
            String remoteAddr = request.getRemoteAddr();
            String trustedProxies = props.getTrustedProxies();
            if (trustedProxies != null && !trustedProxies.isBlank()) {
                List<String> trusted = Arrays.asList(trustedProxies.split(","));
                if (trusted.stream().anyMatch(p -> p.trim().equals(remoteAddr))) {
                    String forwarded = request.getHeader("X-Forwarded-For");
                    if (forwarded != null && !forwarded.isBlank()) {
                        return forwarded.split(",")[0].trim();
                    }
                }
            }
            return remoteAddr;
        }
    }
}
