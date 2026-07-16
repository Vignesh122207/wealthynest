package com.wealthynest.domain.recurringgoalcontribution.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class UpdateRecurringGoalContributionRequest {
    private UUID goalId;
    @Positive
    private BigDecimal amount;
    /** 1–31 = fixed day; 0 = last working day of month */
    @Min(0) @Max(31)
    private Integer dayOfMonth;
}
