package com.wealthynest.domain.income.dto.request;

import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateIncomeRequest {
    private UUID accountId;
    @NotNull  private IncomeSource source;
    private IncomePaymentMode paymentMode;
    @NotNull @Positive private BigDecimal amount;
    @Size(max = 255) private String description;
    @NotNull  private LocalDate incomeDate;
    @NotNull @Min(1) @Max(12) private Integer periodMonth;
    @NotNull @Min(2020)       private Integer periodYear;
}
