package com.wealthynest.domain.auth.dto.request;

import jakarta.validation.constraints.Pattern;
import lombok.Getter;

@Getter
public class EnablePinRequest {
    @Pattern(regexp = "^[0-9]{4,6}$", message = "PIN must be 4 to 6 digits")
    private String pin;

    /** Required only when replacing an already-set PIN — see AuthServiceImpl#enablePin's own
     * comment for why first-time setup deliberately skips this. Null/blank on that first-time
     * path is expected, not an error. */
    private String currentPassword;
}
