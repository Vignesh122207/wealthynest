package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class GoogleLoginRequest {
    @NotBlank
    private String idToken;

    private boolean rememberMe;
}
