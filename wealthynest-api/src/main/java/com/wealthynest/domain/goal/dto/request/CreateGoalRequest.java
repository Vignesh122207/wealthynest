package com.wealthynest.domain.goal.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class CreateGoalRequest {
    @NotBlank @Size(max = 100)
    private String name;

    @Size(max = 10)
    private String icon;

    @Size(max = 7)
    private String color;

    @NotNull @Positive
    private BigDecimal targetAmount;

    @PositiveOrZero
    private BigDecimal savedAmount;

    private LocalDate targetDate;

    private java.util.UUID accountId;
}
