package com.wealthynest.common.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Owns the httpOnly refresh-token cookie — the one piece of the session that must never be
 * readable by JS, so an XSS foothold anywhere in the app can't walk off with a long-lived
 * credential. Access tokens are unaffected and stay in the response body as before; only the
 * refresh token moved here.
 * <p>
 * Scoped to {@code /api/v1} (not just {@code /api/v1/auth}) since session-management endpoints
 * under {@code /api/v1/users/me/sessions} also need to read it. No explicit {@code Domain}
 * attribute — host-only, which is deliberately narrower than a wildcard {@code *.wealthynest.in}
 * cookie and still works for the actual topology here: the API and web app are on different
 * subdomains of the same registrable domain (same-site, not cross-site), and a browser attaches a
 * host-only cookie to any request targeting that exact host regardless of which origin initiated
 * it — exactly what a frontend-to-API call across subdomains needs, without widening the cookie's
 * visibility to the web app's own origin.
 */
@Component
public class RefreshCookieService {

    public static final String COOKIE_NAME = "wn_refresh_token";
    private static final String COOKIE_PATH = "/api/v1";

    // false only in application-dev.yml (local docker-compose, plain HTTP) — a Secure cookie is
    // silently dropped by the browser over HTTP, so leaving this true everywhere would make
    // refresh-token auth work in prod and mysteriously never persist locally.
    @Value("${wealthynest.cookie.secure:true}")
    private boolean secureCookie;

    public void write(HttpServletResponse response, String refreshToken, long maxAgeMs) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(refreshToken, Duration.ofMillis(maxAgeMs)).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    public Optional<String> read(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies())
                .filter(c -> COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
