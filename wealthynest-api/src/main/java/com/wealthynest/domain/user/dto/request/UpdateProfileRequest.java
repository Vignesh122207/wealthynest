package com.wealthynest.domain.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateProfileRequest {
    @Size(min = 2, max = 100, message = "Name must be 2–100 characters")
    private String fullName;

    @Email(message = "Invalid email address")
    @Size(max = 150)
    private String email;
}
