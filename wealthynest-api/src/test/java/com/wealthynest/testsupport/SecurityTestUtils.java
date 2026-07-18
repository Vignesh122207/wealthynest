package com.wealthynest.testsupport;

import com.wealthynest.common.security.UserPrincipal;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

/**
 * Establishes a SecurityContext holding a real UserPrincipal for @WebMvcTest controller tests, so
 * SecurityUtils.requireCurrentUserId()/getCurrentFamilyId() (which every controller calls) resolve
 * exactly as they would against a real JWT-authenticated request — without needing the JWT filter
 * chain, which @WebMvcTest slices deliberately don't load.
 */
public final class SecurityTestUtils {
    private SecurityTestUtils() {}

    public static UUID authenticateAs(UUID userId, UUID familyId, UserRole role) {
        User user = User.builder().fullName("Test User").email("test-" + userId + "@x.com")
                .passwordHash("hash").familyId(familyId).role(role).build();
        ReflectionTestUtils.setField(user, "id", userId);

        UserPrincipal principal = UserPrincipal.from(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        return userId;
    }

    public static UUID authenticateAs(UUID userId, UUID familyId) {
        return authenticateAs(userId, familyId, UserRole.MEMBER);
    }

    public static void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }
}
