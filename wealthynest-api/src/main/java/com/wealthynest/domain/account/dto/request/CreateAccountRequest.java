package com.wealthynest.domain.account.dto.request;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.LoanType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateAccountRequest {
    @NotNull  private AccountType accountType;
    @NotBlank @Size(max = 100) private String name;
    @Size(max = 100) private String bankName;
    @Size(max = 20)  private String accountNumber;
    @NotNull @DecimalMin("0") private BigDecimal openingBalance;
    @DecimalMin("0") private BigDecimal lowBalanceThreshold;

    // Credit card fields (only used when accountType = CREDIT_CARD)
    @DecimalMin("0") private BigDecimal creditLimit;
    @Min(1) @Max(28) private Integer statementDay;
    @Min(1) @Max(28) private Integer paymentDueDay;
    @DecimalMin("0") @DecimalMax("100") private BigDecimal apr;

    // Loan fields (only used when accountType = LOAN; openingBalance = current outstanding,
    // bankName = lender, apr = interest rate)
    private LoanType loanType;
    @DecimalMin("0") private BigDecimal principalAmount;
    @DecimalMin("0") private BigDecimal emiAmount;
    @Min(1) @Max(28) private Integer emiDay;
    private UUID autopayAccountId;
    private LocalDate loanEndDate;
}
