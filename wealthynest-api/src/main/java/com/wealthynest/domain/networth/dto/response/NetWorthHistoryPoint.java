package com.wealthynest.domain.networth.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class NetWorthHistoryPoint {
    private int        year;
    private int        month;
    private String     label;
    private BigDecimal netWorth;
}
