package com.wealthynest.config;

import com.wealthynest.common.util.ClientIpResolver;
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
        /** Comma-separated trusted proxy addresses — either exact IPs or CIDR ranges (e.g.
         * "172.19.0.0/16"). Only requests whose remoteAddr falls in one of these are allowed to
         * set CF-Connecting-IP/X-Forwarded-For; this is what makes it safe to trust those headers
         * behind the Cloudflare Tunnel (see RateLimitFilter's own comment). */
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
        private final ClientIpResolver    clientIpResolver;

        @Override
        public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                throws IOException, ServletException {
            HttpServletRequest  request  = (HttpServletRequest) req;
            HttpServletResponse response = (HttpServletResponse) res;
            String ip   = clientIpResolver.resolve(request);
            String path = request.getRequestURI();
            boolean isAuthPath = path.startsWith("/api/v1/auth/");

            int    limit = isAuthPath ? props.getAuthRequestsPerMinute() : props.getApiRequestsPerMinute();
            String key   = "ratelimit:" + (isAuthPath ? "auth:" : "api:") + ip;

            if (tryConsume(key, limit)) {
                chain.doFilter(req, res);
            } else {
                long retryAfterSeconds = resolveRetryAfterSeconds(key);
                log.warn("Rate limit exceeded for IP: {} on path: {}", ip, path);
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
                response.setContentType("application/json");
                response.getWriter().write(
                    "{\"success\":false,\"status\":429,\"error\":\"RATE_LIMIT_EXCEEDED\"," +
                    "\"message\":\"Too many requests. Please try again later.\"," +
                    "\"retryAfterSeconds\":" + retryAfterSeconds + "}");
            }
        }

        // Best-effort — the rejected request already happened regardless of what this returns, so
        // any failure here just falls back to a flat 60s rather than blocking the 429 response.
        private long resolveRetryAfterSeconds(String key) {
            try {
                Long ttl = redisTemplate.getExpire(key, java.util.concurrent.TimeUnit.SECONDS);
                return ttl != null && ttl > 0 ? ttl : 60L;
            } catch (Exception e) {
                return 60L;
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
    }
}
