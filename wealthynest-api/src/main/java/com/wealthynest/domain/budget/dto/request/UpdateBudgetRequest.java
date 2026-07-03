package com.wealthynest.domain.budget.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class UpdateBudgetRequest {
    @Positive
    private BigDecimal amount;

    @DecimalMin("1") @DecimalMax("100")
    private BigDecimal alertThreshold;

    private UUID categoryId;
}
