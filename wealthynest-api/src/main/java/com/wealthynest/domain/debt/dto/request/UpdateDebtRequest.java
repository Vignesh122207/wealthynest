package com.wealthynest.domain.debt.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class UpdateDebtRequest {
    @Size(max = 100)
    private String contactName;

    @Size(max = 20)
    private String contactPhone;

    @Positive
    private BigDecimal amount;

    @Size(max = 255)
    private String description;

    private LocalDate debtDate;

    private LocalDate dueDate;
}
