package com.wealthynest.domain.user.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.security.TokenRevocationService;
import com.wealthynest.common.security.UserPrincipal;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.user.dto.request.ChangePasswordRequest;
import com.wealthynest.domain.user.dto.request.UpdateProfileRequest;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository         userRepository;
    private final UserMapper             userMapper;
    private final PasswordEncoder        passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditService           auditService;
    private final TokenRevocationService tokenRevocationService;
    private final WebAuthnCredentialRepository webAuthnCredentialRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        return UserPrincipal.from(user);
    }

    @Override
    @Transactional(readOnly = true)
    public User findById(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    @Override
    @Transactional(readOnly = true)
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getProfile(UUID userId) {
        return toResponseWithPasskeys(findById(userId));
    }

    @Override
    @Transactional
    public UserResponse updateLastLogin(UUID userId) {
        User user = findById(userId);
        user.setLastLoginAt(Instant.now());
        return toResponseWithPasskeys(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = findById(userId);
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        return toResponseWithPasskeys(userRepository.save(user));
    }

    private UserResponse toResponseWithPasskeys(User user) {
        return userMapper.toResponse(user, webAuthnCredentialRepository.existsByUserId(user.getId()));
    }

    @Override
    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request, String ipAddress, String userAgent) {
        User user = findById(userId);
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST, "WRONG_PASSWORD");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        // Match forgot-password's behavior: a password change should invalidate every
        // other session, not just leave old refresh tokens usable until they expire.
        refreshTokenRepository.revokeAllByUserId(userId);
        // Also invalidate any access token already issued — otherwise a leaked token
        // stays valid for up to its full lifetime even after the password changes.
        tokenRevocationService.revokeAllTokensFor(userId);
        log.info("Password changed by user {}", userId);
        auditService.log(userId, "PASSWORD_CHANGED", "USER", userId, null, null, ipAddress, userAgent);
    }

    @Override
    @Transactional
    public void closeAccount(UUID userId) {
        User user = findById(userId);
        user.setActive(false);
        userRepository.save(user);
        refreshTokenRepository.revokeAllByUserId(userId);
        log.info("Account closed by user {}", userId);
    }
}
