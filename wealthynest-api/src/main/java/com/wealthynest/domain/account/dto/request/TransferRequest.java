package com.wealthynest.domain.account.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class TransferRequest {
    @NotNull private UUID fromAccountId;
    @NotNull private UUID toAccountId;
    @NotNull @Positive private BigDecimal amount;
    @Size(max = 255) private String description;
    @NotNull private LocalDate transferDate;
}
