package com.wealthynest.domain.user.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

// Email is deliberately not editable here — see AuthService.changeEmail for the verified-swap
// flow that replaces the old silent "set email, unverify, hope they notice" behavior.
@Getter
@NoArgsConstructor
public class UpdateProfileRequest {
    @Size(min = 2, max = 100, message = "Name must be 2–100 characters")
    private String fullName;
}
