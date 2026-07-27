package com.wealthynest.domain.notification.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class RegisterDeviceTokenRequest {
    @NotBlank private String token;
}
