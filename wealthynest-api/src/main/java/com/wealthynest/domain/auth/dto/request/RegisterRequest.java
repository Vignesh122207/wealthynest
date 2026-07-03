package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;

@Getter
public class RegisterRequest {
    @NotBlank @Size(min = 2, max = 100)
    private String fullName;

    @NotBlank @Email @Size(max = 150)
    private String email;

    @NotBlank @Size(min = 8, max = 72)
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).*$",
             message = "Password must contain uppercase, lowercase, and a digit")
    private String password;
}
