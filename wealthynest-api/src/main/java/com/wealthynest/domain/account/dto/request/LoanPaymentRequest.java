package com.wealthynest.domain.account.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class LoanPaymentRequest {
    @NotNull @DecimalMin(value = "0", inclusive = false)
    private BigDecimal amount;
    /** Account the payment is debited from; null = paid from an untracked source. */
    private UUID fromAccountId;
}
