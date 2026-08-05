package com.wealthynest.domain.investment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class InvestmentResponse {
    private UUID       id;
    private String     investmentType;
    private String     symbol;
    private String     exchange;
    private String     schemeCode;
    private String     companyName;
    private BigDecimal units;
    private BigDecimal avgBuyPrice;
    private BigDecimal currentPrice;
    private BigDecimal livePrice;        // from cache, may differ from stored currentPrice
    private BigDecimal investedAmount;
    private BigDecimal currentValue;
    private BigDecimal gainLoss;
    private double     gainLossPct;
    private BigDecimal sipAmount;
    private Integer    sipDay;
    /** Next occurrence of sipDay on/after today, clamped to month length — null when sipDay isn't set. */
    private LocalDate  nextSipDate;
    private LocalDate  purchaseDate;
    private BigDecimal faceValue;
    private BigDecimal couponRate;
    private String     couponFrequency;
    private Integer    couponCreditDay;
    private LocalDate  maturityDate;
    private String     bankName;
    private String     compoundingFrequency;
    private BigDecimal quantityGrams;
    private Integer    goldKarat;
    private BigDecimal maturityAmount;   // computed for FD/Bond
    private BigDecimal accruedInterest;  // computed for FD (days elapsed)
    private UUID       linkedAccountId;
    private UUID       debitAccountId;
    private String     debitAccountName;
    private BigDecimal tdsRate;       // TDS % for bond coupons
    private BigDecimal brokerage;     // Brokerage paid on purchase
    private String     broker;        // Purely descriptive — which platform holds this
    private String     purpose;
    private String     purposeLabel;
    private String     notes;
    private String     status;
    private Instant    createdAt;
    // Price cache data
    private BigDecimal dayChange;
    private BigDecimal dayChangePct;
    private BigDecimal week52High;
    private BigDecimal week52Low;
    private Instant    priceLastUpdated;
    /** STOCK only — number of buy/sell transactions on record. Once &gt;1, units/avgBuyPrice are
     * derived from the transaction ledger (weighted average cost), so the frontend disables
     * direct editing of those fields and points to Buy More/Sell instead. */
    private int        transactionCount;
}
