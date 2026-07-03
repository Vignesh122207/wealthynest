package com.wealthynest.domain.liability.dto.request;

import com.wealthynest.domain.liability.entity.LiabilityType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class CreateLiabilityRequest {
    @NotBlank @Size(max = 100) private String        name;
    @NotNull                   private LiabilityType liabilityType;
    @NotNull @PositiveOrZero   private BigDecimal    principalAmount;
    @NotNull @PositiveOrZero   private BigDecimal    outstandingAmount;
    @DecimalMin("0.0") @DecimalMax("100.0") private BigDecimal interestRate;
    @Size(max = 100)           private String        lenderName;
    @PositiveOrZero            private BigDecimal    emiAmount;
    private LocalDate startDate;
    private LocalDate endDate;
    private String    notes;
}
