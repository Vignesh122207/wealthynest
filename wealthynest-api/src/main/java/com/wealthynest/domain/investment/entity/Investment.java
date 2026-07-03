package com.wealthynest.domain.investment.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "investments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Investment extends BaseEntity {
    @Column(name = "asset_id",  nullable = false) private UUID assetId;
    @Column(name = "user_id",   nullable = false) private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "investment_type", nullable = false, length = 30) private InvestmentType investmentType;

    @Column(length = 30)    private String symbol;
    @Column(length = 10)    @Builder.Default private String exchange = "NSE";
    @Column(name = "scheme_code",  length = 20)  private String schemeCode;
    @Column(name = "company_name", length = 200) private String companyName;

    @Column(precision = 14, scale = 4) private BigDecimal units;
    @Column(name = "avg_buy_price",  precision = 14, scale = 4) private BigDecimal avgBuyPrice;
    @Column(name = "current_price",  precision = 14, scale = 4) private BigDecimal currentPrice;
    @Column(name = "invested_amount", nullable = false, precision = 16, scale = 2) private BigDecimal investedAmount;
    @Column(name = "current_value",   nullable = false, precision = 16, scale = 2) private BigDecimal currentValue;
    @Column(name = "sip_amount", precision = 14, scale = 2) private BigDecimal sipAmount;
    @Column(name = "sip_day") private Integer sipDay;

    @Column(name = "purchase_date") private LocalDate purchaseDate;
    @Column(name = "coupon_rate",   precision = 5, scale = 2) private BigDecimal couponRate;
    @Column(name = "coupon_frequency", length = 20) private String couponFrequency;
    @Column(name = "coupon_credit_day") private Integer couponCreditDay;
    @Column(name = "maturity_date") private LocalDate maturityDate;
    @Column(name = "bank_name",     length = 100) private String bankName;
    @Column(name = "compounding_frequency", length = 20) private String compoundingFrequency;
    @Column(name = "quantity_grams", precision = 10, scale = 4) private BigDecimal quantityGrams;
    @Column(name = "gold_karat") @Builder.Default private Integer goldKarat = 22;
    @Column(name = "linked_account_id") private UUID linkedAccountId;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "is_active") @Builder.Default private boolean active = true;
    @Column(name = "debit_expense_id")  private UUID debitExpenseId;
    @Column(name = "debit_account_id")  private UUID debitAccountId;
    @Column(name = "debit_transfer_id") private UUID debitTransferId;
}
