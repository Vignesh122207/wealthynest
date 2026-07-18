package com.wealthynest.domain.debt.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
public class RecordPaymentRequest {
    @NotNull @Positive
    private BigDecimal amount;

    @Size(max = 255)
    private String note;
}
