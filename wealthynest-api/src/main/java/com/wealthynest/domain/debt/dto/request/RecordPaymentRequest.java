package com.wealthynest.domain.debt.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class RecordPaymentRequest {
    @NotNull @Positive
    private BigDecimal amount;

    @Size(max = 255)
    private String note;

    /** Defaults to today (DebtServiceImpl#recordPayment) when omitted — lets a payment be logged
     * as having happened on an earlier date instead of always dating it to whenever it was typed
     * in, same as CreateDebtRequest's debtDate. */
    private LocalDate paidAt;
}
