package com.wealthynest.domain.investment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class InvestmentSearchResult {
    private String symbol;
    private String name;
    private String exchange;
    private String type; // STOCK | MF
    private String schemeCode;
}
