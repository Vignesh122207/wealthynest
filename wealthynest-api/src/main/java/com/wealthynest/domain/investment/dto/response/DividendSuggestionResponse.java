package com.wealthynest.domain.investment.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data @Builder
public class DividendSuggestionResponse {
    private UUID       investmentId;
    private String     symbol;
    private String     companyName;
    private LocalDate  exDate;
    private BigDecimal dividendPerShare;
    private BigDecimal sharesHeld;
    private BigDecimal suggestedIncome;   // dividendPerShare × sharesHeld
    private boolean    alreadyLogged;
}
