package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

// Same shape as PinLoginRequest (just @NotBlank, not EnablePinRequest's 4-6-digit @Pattern) — this
// PIN is checked against an existing hash, not stored as a new one, so there's nothing to
// constrain the format of beyond "was actually submitted."
@Getter
public class DisablePinRequest {
    @NotBlank
    private String pin;
}
