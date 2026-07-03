package com.wealthynest.domain.investment.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateSipTransactionRequest {
    @NotNull LocalDate transactionDate;
    @NotNull @DecimalMin("0.01") BigDecimal amount;
    BigDecimal units;
    BigDecimal nav;
    String transactionType = "BUY";  // BUY | REDEEM
    String notes;
}
