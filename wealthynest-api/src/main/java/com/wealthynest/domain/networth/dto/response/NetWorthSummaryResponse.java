package com.wealthynest.domain.networth.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.List;

@Getter @Builder
public class NetWorthSummaryResponse {

    // Totals
    private BigDecimal totalNetWorth;
    private BigDecimal totalAssets;
    private BigDecimal totalLiabilities;

    // Auto-linked asset buckets
    private BigDecimal liquidBalance;       // cash wallet + bank accounts
    private BigDecimal emergencyFund;       // emergency fund accounts
    private BigDecimal investmentValue;     // total investment portfolio value

    // Manual assets total
    private BigDecimal manualAssetsValue;

    // Breakdown lists for the UI
    private List<AssetBreakdown>     assetBreakdown;
    private List<LiabilityBreakdown> liabilityBreakdown;

    @Getter @Builder
    public static class AssetBreakdown {
        private String     assetType;
        private BigDecimal totalValue;
        private long       count;
    }

    @Getter @Builder
    public static class LiabilityBreakdown {
        private String     liabilityType;
        private BigDecimal totalOutstanding;
        private long       count;
    }
}
