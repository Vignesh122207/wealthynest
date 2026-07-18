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
public class StockTransactionResponse {
    private Long      id;
    private UUID      investmentId;
    private LocalDate transactionDate;
    private String    transactionType;
    private BigDecimal quantity;
    private BigDecimal pricePerShare;
    private BigDecimal brokerage;
    private String    notes;
    private Instant   createdAt;
}
