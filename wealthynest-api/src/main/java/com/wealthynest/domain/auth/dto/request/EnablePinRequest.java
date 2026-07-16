package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;

@Getter
public class EnablePinRequest {
    @NotBlank
    private String currentPassword;

    @Pattern(regexp = "^[0-9]{4,6}$", message = "PIN must be 4 to 6 digits")
    private String pin;
}
