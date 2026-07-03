package com.wealthynest.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.Optional;
import java.util.UUID;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static Optional<UUID> getCurrentUserId() {
        return getCurrentUserPrincipal().map(UserPrincipal::getId);
    }
    public static UUID requireCurrentUserId() {
        return getCurrentUserId().orElseThrow(() -> new IllegalStateException("No authenticated user in context"));
    }
    public static Optional<String> getCurrentUserEmail() {
        return getCurrentUserPrincipal().map(UserPrincipal::getEmail);
    }
    public static Optional<UUID> getCurrentFamilyId() {
        return getCurrentUserPrincipal().map(UserPrincipal::getFamilyId);
    }
    public static boolean hasRole(String role) {
        return getCurrentUserPrincipal()
                .map(p -> p.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_" + role)))
                .orElse(false);
    }
    private static Optional<UserPrincipal> getCurrentUserPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            return Optional.of(principal);
        }
        return Optional.empty();
    }
}
