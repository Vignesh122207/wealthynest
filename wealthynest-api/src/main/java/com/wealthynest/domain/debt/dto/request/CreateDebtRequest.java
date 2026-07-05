package com.wealthynest.domain.debt.dto.request;

import com.wealthynest.domain.debt.entity.DebtType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateDebtRequest {
    @NotNull
    private DebtType type;

    private UUID accountId;

    @NotBlank @Size(max = 100)
    private String contactName;

    @Size(max = 20)
    private String contactPhone;

    @NotNull @Positive
    private BigDecimal amount;

    @Size(max = 255)
    private String description;

    private LocalDate debtDate;

    private LocalDate dueDate;
}
