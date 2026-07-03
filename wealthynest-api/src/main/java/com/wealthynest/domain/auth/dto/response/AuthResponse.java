package com.wealthynest.domain.auth.dto.response;

import com.wealthynest.domain.user.dto.response.UserResponse;
import lombok.Builder;
import lombok.Getter;

@Getter @Builder
public class AuthResponse {
    private String       accessToken;
    private String       refreshToken;
    private long         expiresIn;
    private String       tokenType;
    private UserResponse user;
}
