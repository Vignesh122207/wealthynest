package com.wealthynest.domain.investment.dto.response;

import lombok.*;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class InvestmentSearchResult {
    private String symbol;
    private String name;
    private String exchange;
    private String type; // STOCK | MF
    private String schemeCode;
}
