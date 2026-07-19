package com.wealthynest.domain.recurringtransfer.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class CreateRecurringTransferRequest {
    @NotNull
    private UUID fromAccountId;
    @NotNull
    private UUID toAccountId;
    @NotNull @Positive
    private BigDecimal amount;
    @Size(max = 255)
    private String description;
    /** 1–31 = fixed day; 0 = last working day of month */
    @NotNull @Min(0) @Max(31)
    private Integer dayOfMonth;
}
