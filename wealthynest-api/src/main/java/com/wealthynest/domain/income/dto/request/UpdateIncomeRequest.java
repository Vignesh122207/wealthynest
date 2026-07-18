package com.wealthynest.domain.income.dto.request;

import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class UpdateIncomeRequest {
    private UUID accountId;
    private IncomeSource source;
    private IncomePaymentMode paymentMode;
    @Positive private BigDecimal amount;
    @Size(max = 255) private String description;
    private LocalDate incomeDate;
    @Min(1) @Max(12) private Integer periodMonth;
    @Min(2020) private Integer periodYear;
}
