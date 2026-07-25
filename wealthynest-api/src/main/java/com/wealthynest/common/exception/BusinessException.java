package com.wealthynest.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Getter
public class BusinessException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    /** Optional structured extras a frontend can act on programmatically (e.g. a lockout's
     * {@code lockedUntil} timestamp) — separate from the human-readable message, which stays
     * free-form. Null for the overwhelming majority of call sites that don't need this. */
    private final Map<String, String> details;

    public BusinessException(String message, HttpStatus status, String code, Map<String, String> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public BusinessException(String message, HttpStatus status, String code) {
        this(message, status, code, null);
    }

    public BusinessException(String message, HttpStatus status) {
        this(message, status, "BUSINESS_ERROR", null);
    }
}
