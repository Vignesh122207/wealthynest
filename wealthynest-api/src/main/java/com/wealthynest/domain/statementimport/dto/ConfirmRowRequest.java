package com.wealthynest.domain.statementimport.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class ConfirmRowRequest {
    @NotNull  private LocalDate date;
    private String description;
    @NotNull @Positive private BigDecimal amount;
    @NotBlank private String type;              // "DEBIT" or "CREDIT"
    private UUID   categoryId;                  // DEBIT rows only; null falls back to the system "Other" category
    private String incomeSource;                // optional for CREDIT rows, defaults to OTHER
}
