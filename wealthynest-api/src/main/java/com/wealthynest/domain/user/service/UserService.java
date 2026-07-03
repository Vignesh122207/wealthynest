package com.wealthynest.domain.user.service;

import com.wealthynest.domain.user.dto.request.ChangePasswordRequest;
import com.wealthynest.domain.user.dto.request.UpdateProfileRequest;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import java.util.UUID;

public interface UserService extends UserDetailsService {
    User findById(UUID id);
    User findByEmail(String email);
    UserResponse getProfile(UUID userId);
    UserResponse updateLastLogin(UUID userId);
    UserResponse updateProfile(UUID userId, UpdateProfileRequest request);
    void changePassword(UUID userId, ChangePasswordRequest request);
    void closeAccount(UUID userId);
}
