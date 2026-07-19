package com.wealthynest.domain.recurringincome.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class UpdateRecurringIncomeRequest {
    private UUID accountId;
    private String source;
    @Positive
    private BigDecimal amount;
    @Size(max = 255)
    private String description;
    /** 1–31 = fixed day; 0 = last working day of month */
    @Min(0) @Max(31)
    private Integer dayOfMonth;
}
