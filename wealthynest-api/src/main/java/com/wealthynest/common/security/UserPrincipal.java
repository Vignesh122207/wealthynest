package com.wealthynest.common.security;

import com.wealthynest.domain.user.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Getter
public class UserPrincipal implements UserDetails {
    private final UUID   id;
    private final String email;
    private final String password;
    private final String fullName;
    private final UUID   familyId;
    private final boolean active;
    private final Instant lockedUntil;
    private final Collection<? extends GrantedAuthority> authorities;

    private UserPrincipal(User user) {
        this.id          = user.getId();
        this.email       = user.getEmail();
        this.password    = user.getPasswordHash();
        this.fullName    = user.getFullName();
        this.familyId    = user.getFamilyId();
        this.active      = user.isActive();
        this.lockedUntil = user.getLockedUntil();
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    public static UserPrincipal from(User user) { return new UserPrincipal(user); }

    @Override public String getUsername()              { return email; }
    @Override public boolean isAccountNonExpired()     { return true; }
    @Override public boolean isAccountNonLocked()      { return lockedUntil == null || Instant.now().isAfter(lockedUntil); }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled()               { return active; }
}
