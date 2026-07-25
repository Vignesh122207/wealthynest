package com.wealthynest.testsupport;

import com.wealthynest.common.security.JwtTokenProvider;
import com.wealthynest.common.security.RefreshCookieService;
import com.wealthynest.common.security.TokenRevocationService;
import com.wealthynest.config.CorsProperties;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.mock;

/**
 * Supplies the non-JWT-parsing beans SecurityConfig's constructor needs (JwtTokenProvider,
 * UserDetailsService, TokenRevocationService, PasswordEncoder, CorsProperties) so @WebMvcTest
 * slices can import the REAL SecurityConfig/SecurityFilterChain — giving accurate 401/403
 * responses via the real ExceptionTranslationFilter/authenticationEntryPoint/accessDeniedHandler,
 * exactly as production behaves, instead of falling through to GlobalExceptionHandler's generic
 * 500 handler the way addFilters=false would. Controller tests never send an Authorization
 * header, so JwtAuthenticationFilter's real doFilterInternal short-circuits before touching any
 * of these mocks; SecurityTestUtils.authenticateAs() sets the SecurityContext directly for the
 * "logged in" test cases instead.
 * <p>
 * RefreshCookieService is the real bean, not a mock — AuthController/UserController depend on it
 * directly (not via SecurityConfig), and its cookie-building logic has no external I/O, so
 * exercising the real thing lets controller tests assert on the actual Set-Cookie header.
 */
@TestConfiguration
public class SecurityTestConfig {
    @Bean public JwtTokenProvider jwtTokenProvider() { return mock(JwtTokenProvider.class); }
    @Bean public UserDetailsService userDetailsService() { return mock(UserDetailsService.class); }
    @Bean public TokenRevocationService tokenRevocationService() { return mock(TokenRevocationService.class); }
    @Bean public PasswordEncoder passwordEncoder() { return mock(PasswordEncoder.class); }
    @Bean public CorsProperties corsProperties() { return new CorsProperties(); }
    @Bean public RefreshCookieService refreshCookieService() { return new RefreshCookieService(); }
}
