package com.wealthynest.domain.account.dto.request;

import com.wealthynest.domain.account.entity.AccountType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
public class CreateAccountRequest {
    @NotNull  private AccountType accountType;
    @NotBlank @Size(max = 100) private String name;
    @Size(max = 100) private String bankName;
    @Size(max = 20)  private String accountNumber;
    @NotNull @DecimalMin("0") private BigDecimal openingBalance;

    // Credit card fields (only used when accountType = CREDIT_CARD)
    @DecimalMin("0") private BigDecimal creditLimit;
    @Min(1) @Max(28) private Integer statementDay;
    @Min(1) @Max(28) private Integer paymentDueDay;
    @DecimalMin("0") @DecimalMax("100") private BigDecimal apr;
}
