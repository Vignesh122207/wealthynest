package com.wealthynest.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import io.jsonwebtoken.Claims;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX        = "Bearer ";

    private final JwtTokenProvider        jwtTokenProvider;
    private final UserDetailsService       userDetailsService;
    private final TokenRevocationService   tokenRevocationService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        response.setHeader("X-Request-Id", requestId);
        // Populates the %X{requestId} slot the log pattern in application.yml already expects —
        // without this, every log line for this request renders an empty bracket.
        MDC.put("requestId", requestId);
        try {
            String token = extractToken(request);
            if (StringUtils.hasText(token)) {
                // Parsed once here and reused for every check below — isTokenValid/isAccessToken/
                // extractSubject/extractAllClaims each independently re-parse and re-verify the
                // signature, which is wasted work on every single authenticated request.
                Optional<Claims> maybeClaims = jwtTokenProvider.parseValidClaims(token);
                if (maybeClaims.isPresent() && "ACCESS".equals(maybeClaims.get().get("type", String.class))) {
                    Claims claims = maybeClaims.get();
                    try {
                        String email = claims.getSubject();
                        if (StringUtils.hasText(email) && SecurityContextHolder.getContext().getAuthentication() == null) {
                            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                            if (!userDetails.isEnabled()) {
                                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Account is disabled");
                                return;
                            }
                            UUID userId = UUID.fromString(claims.getId());
                            if (tokenRevocationService.isRevoked(userId, claims.getIssuedAt())) {
                                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Session expired, please log in again");
                                return;
                            }
                            UsernamePasswordAuthenticationToken authToken =
                                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                            SecurityContextHolder.getContext().setAuthentication(authToken);
                        }
                    } catch (Exception e) {
                        log.error("Could not authenticate user from JWT: {}", e.getMessage(), e);
                        SecurityContextHolder.clearContext();
                    }
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
        }
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
