package com.wealthynest.domain.investment.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class CreateStockTransactionRequest {
    @NotNull
    private LocalDate transactionDate;

    @NotBlank
    private String transactionType; // BUY or SELL

    @NotNull @Positive
    private BigDecimal quantity;

    @NotNull @Positive
    private BigDecimal pricePerShare;

    @PositiveOrZero
    private BigDecimal brokerage;

    private java.util.UUID debitAccountId;

    @Size(max = 500)
    private String notes;
}
