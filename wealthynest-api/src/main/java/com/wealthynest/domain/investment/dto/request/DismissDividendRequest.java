package com.wealthynest.domain.investment.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class DismissDividendRequest {
    @NotBlank
    private String exDate; // ISO date string, e.g. "2025-12-15"
}
