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
    private BigDecimal investmentValue;     // total investment portfolio value

    // Manual assets total
    private BigDecimal manualAssetsValue;

    // Breakdown lists for the UI
    private List<AssetBreakdown>     assetBreakdown;
    private List<LiabilityBreakdown> liabilityBreakdown;

    /** Re-slice of the same accounts/investments already counted once above, grouped by their
     * optional purpose tag — never added into totalAssets, purely a display breakdown. */
    private List<PurposeBreakdown> purposeBreakdown;

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

    @Getter @Builder
    public static class PurposeBreakdown {
        private String     purpose;     // enum name, or the CUSTOM label's own grouping key
        private String     label;       // display label — purpose name, or the custom label itself
        private BigDecimal totalValue;
        private List<PurposeItem> items;
    }

    @Getter @Builder
    public static class PurposeItem {
        private String     sourceType;  // "ACCOUNT" or "INVESTMENT"
        private String     name;
        private BigDecimal amount;
    }
}
