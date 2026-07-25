package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class PinLoginRequest {
    @NotBlank
    private String pin;
}
