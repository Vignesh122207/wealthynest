package com.wealthynest.domain.investment.dto.request;

import com.wealthynest.domain.investment.entity.InvestmentType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateInvestmentRequest {
    private UUID assetId;

    @NotNull private InvestmentType investmentType;
    @Size(max = 30)  private String symbol;
    @Size(max = 10)  private String exchange;
    @Size(max = 20)  private String schemeCode;
    @Size(max = 200) private String companyName;

    @PositiveOrZero private BigDecimal units;
    @PositiveOrZero private BigDecimal avgBuyPrice;
    @PositiveOrZero private BigDecimal currentPrice;
    @NotNull @PositiveOrZero private BigDecimal investedAmount;
    @NotNull @PositiveOrZero private BigDecimal currentValue;

    @PositiveOrZero private BigDecimal sipAmount;
    @Min(1) @Max(31) private Integer sipDay;

    private LocalDate purchaseDate;

    // Bond / FD fields
    @Positive private BigDecimal faceValue;                 // par value per bond unit (e.g. ₹1000); used for coupon & maturity calc
    @PositiveOrZero @DecimalMax("100") private BigDecimal couponRate;
    @Size(max = 20) private String couponFrequency;       // MONTHLY, QUARTERLY, HALF_YEARLY, ANNUALLY
    @Min(1) @Max(31) private Integer couponCreditDay;     // day of month for coupon payment
    private LocalDate maturityDate;
    @Size(max = 100) private String bankName;
    @Size(max = 20)  private String compoundingFrequency; // SIMPLE, MONTHLY, QUARTERLY, HALF_YEARLY, ANNUALLY

    // Gold
    @PositiveOrZero private BigDecimal quantityGrams;
    private Integer goldKarat; // 18, 22, or 24 — defaults to 22

    // Auto-income target account
    private UUID linkedAccountId;

    // Optional: debit this account when creating the investment
    private UUID debitAccountId;

    // TDS rate for bond coupons (0–30%)
    @PositiveOrZero @DecimalMax("30") private BigDecimal tdsRate;

    // Brokerage paid on stock/bond purchase (added to debit amount, separate from investedAmount)
    @PositiveOrZero private BigDecimal brokerage;

    private String notes;
}
