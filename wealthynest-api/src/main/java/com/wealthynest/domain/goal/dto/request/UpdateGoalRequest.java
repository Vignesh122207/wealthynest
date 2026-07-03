package com.wealthynest.domain.goal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class UpdateGoalRequest {
    @Size(max = 100)
    private String name;

    @Size(max = 10)
    private String icon;

    @Size(max = 7)
    private String color;

    @Positive
    private BigDecimal targetAmount;

    @PositiveOrZero
    private BigDecimal savedAmount;

    private LocalDate targetDate;

    private java.util.UUID accountId;

    private Boolean unlinkAccount;

    private Boolean paused;
}
