package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ChangeEmailRequest {
    @NotBlank
    @Email(message = "Invalid email address")
    @Size(max = 150)
    private String newEmail;

    @NotBlank
    private String currentPassword;
}
