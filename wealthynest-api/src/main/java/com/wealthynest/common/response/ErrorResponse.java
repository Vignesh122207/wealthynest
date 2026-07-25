package com.wealthynest.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.Map;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {
    private final boolean success;
    private final int status;
    private final String error;
    private final String message;
    private final String path;
    private final Map<String, String> fieldErrors;
    /** Structured extras for programmatic handling — e.g. a lockout's {@code lockedUntil} — as
     * opposed to {@code message}, which is just human-readable copy. See BusinessException. */
    private final Map<String, String> details;
    @Builder.Default
    private final Instant timestamp = Instant.now();
}
