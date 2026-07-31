package com.wealthynest.common.util;

import com.wealthynest.config.RateLimitConfig.RateLimitProperties;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;

/**
 * Resolves the real client IP behind cloudflared (see docker-compose.yml's `tunnel` service),
 * which proxies straight to http://wealthynest-api:8080 over the docker network — every request
 * arriving through the public domain therefore has the SAME {@code remoteAddr} (the tunnel
 * container's), not the visitor's. Trusts that container's subnet (RATE_LIMIT_TRUSTED_PROXIES,
 * pinned in docker-compose.yml's networks.wealthynest-net.ipam) and reads the true client IP
 * Cloudflare's edge attaches to the request instead.
 *
 * Shares {@link RateLimitProperties#getTrustedProxies()} with RateLimitFilter (same trust
 * boundary — only that filter used to have this logic; callers that record an IP for display or
 * audit, e.g. session rows on Settings > Security, called {@code request.getRemoteAddr()}
 * directly and always got the tunnel's own address instead of the visitor's).
 */
@Component
@RequiredArgsConstructor
public class ClientIpResolver {
    private final RateLimitProperties props;

    public String resolve(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (!isTrustedProxy(remoteAddr)) {
            return remoteAddr;
        }
        // Set by Cloudflare's edge to the real visitor IP — preferred over X-Forwarded-For, which
        // a multi-hop chain could pad with attacker-controlled entries before it ever reaches
        // cloudflared.
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
            return cfConnectingIp.trim();
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return remoteAddr;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        String trustedProxies = props.getTrustedProxies();
        if (trustedProxies == null || trustedProxies.isBlank()) return false;
        return Arrays.stream(trustedProxies.split(","))
                .map(String::trim)
                .filter(p -> !p.isEmpty())
                .anyMatch(entry -> matchesEntry(remoteAddr, entry));
    }

    private boolean matchesEntry(String remoteAddr, String entry) {
        if (!entry.contains("/")) {
            return entry.equals(remoteAddr);
        }
        try {
            String[] parts = entry.split("/", 2);
            byte[] network = InetAddress.getByName(parts[0]).getAddress();
            byte[] address = InetAddress.getByName(remoteAddr).getAddress();
            int prefixLength = Integer.parseInt(parts[1]);
            if (network.length != address.length) return false;

            int fullBytes = prefixLength / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (network[i] != address[i]) return false;
            }
            int remainingBits = prefixLength % 8;
            if (remainingBits > 0) {
                int mask = 0xFF00 >> remainingBits & 0xFF;
                if ((network[fullBytes] & mask) != (address[fullBytes] & mask)) return false;
            }
            return true;
        } catch (UnknownHostException | NumberFormatException | IndexOutOfBoundsException e) {
            return false;
        }
    }
}
