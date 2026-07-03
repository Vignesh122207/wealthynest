package com.wealthynest.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    @Slf4j
    @Component
    @Order(1)
    @RequiredArgsConstructor
    public static class RateLimitFilter implements Filter {
        private final RateLimitProperties props;

        private final Map<String, Bucket>  authBuckets   = new ConcurrentHashMap<>();
        private final Map<String, Bucket>  apiBuckets    = new ConcurrentHashMap<>();
        private final Map<String, Instant> authLastSeen  = new ConcurrentHashMap<>();
        private final Map<String, Instant> apiLastSeen   = new ConcurrentHashMap<>();

        @Override
        public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
                throws IOException, ServletException {
            HttpServletRequest  request  = (HttpServletRequest) req;
            HttpServletResponse response = (HttpServletResponse) res;
            String ip   = resolveClientIp(request);
            String path = request.getRequestURI();
            boolean isAuthPath = path.startsWith("/api/v1/auth/");

            Bucket bucket;
            if (isAuthPath) {
                authLastSeen.put(ip, Instant.now());
                bucket = authBuckets.computeIfAbsent(ip, k -> buildBucket(props.getAuthRequestsPerMinute()));
            } else {
                apiLastSeen.put(ip, Instant.now());
                bucket = apiBuckets.computeIfAbsent(ip, k -> buildBucket(props.getApiRequestsPerMinute()));
            }

            if (bucket.tryConsume(1)) {
                chain.doFilter(req, res);
            } else {
                log.warn("Rate limit exceeded for IP: {} on path: {}", ip, path);
                response.setStatus(429);
                response.setContentType("application/json");
                response.getWriter().write(
                    "{\"success\":false,\"status\":429,\"error\":\"RATE_LIMIT_EXCEEDED\",\"message\":\"Too many requests. Please try again later.\"}");
            }
        }

        /** Evict buckets not seen in the last 30 minutes to prevent unbounded memory growth. */
        @Scheduled(fixedDelay = 600_000)
        public void evictStaleBuckets() {
            Instant cutoff = Instant.now().minusSeconds(1800);
            authLastSeen.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
            authBuckets.keySet().retainAll(authLastSeen.keySet());
            apiLastSeen.entrySet().removeIf(e -> e.getValue().isBefore(cutoff));
            apiBuckets.keySet().retainAll(apiLastSeen.keySet());
            log.debug("Rate-limiter eviction: auth={} api={}", authBuckets.size(), apiBuckets.size());
        }

        private Bucket buildBucket(int requestsPerMinute) {
            return Bucket.builder()
                    .addLimit(Bandwidth.classic(requestsPerMinute,
                            Refill.intervally(requestsPerMinute, Duration.ofMinutes(1))))
                    .build();
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
