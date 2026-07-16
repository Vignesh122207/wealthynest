package com.wealthynest.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

        String token = extractToken(request);
        if (StringUtils.hasText(token) && jwtTokenProvider.isTokenValid(token) && jwtTokenProvider.isAccessToken(token)) {
            try {
                String email = jwtTokenProvider.extractSubject(token);
                if (StringUtils.hasText(email) && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                    if (!userDetails.isEnabled()) {
                        response.sendError(HttpServletResponse.SC_FORBIDDEN, "Account is disabled");
                        return;
                    }
                    Claims claims = jwtTokenProvider.extractAllClaims(token);
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
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
