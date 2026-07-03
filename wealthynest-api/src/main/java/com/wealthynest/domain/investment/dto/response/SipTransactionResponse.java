package com.wealthynest.domain.investment.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data @Builder
public class SipTransactionResponse {
    private Long        id;
    private LocalDate   transactionDate;
    private BigDecimal  amount;
    private BigDecimal  units;
    private BigDecimal  nav;
    private String      transactionType;
    private String      notes;
}
