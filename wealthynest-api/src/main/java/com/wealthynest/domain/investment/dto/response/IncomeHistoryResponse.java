package com.wealthynest.domain.investment.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Builder
public class IncomeHistoryResponse {

    private Summary         summary;
    private List<Record>    records;

    @Getter @Builder
    public static class Summary {
        private int        year;
        private BigDecimal dividendTotal;
        private BigDecimal bondCouponTotal;
        private BigDecimal fdMaturityTotal;
        private BigDecimal grandTotal;
    }

    @Getter @Builder
    public static class Record {
        private UUID       id;
        private String     incomeType;       // DIVIDEND | BOND_COUPON | FD_MATURITY
        private LocalDate  eventDate;
        private BigDecimal amount;
        private BigDecimal perShare;         // non-null for DIVIDEND
        private UUID       investmentId;
        private String     investmentName;   // company/bank name
        private String     symbol;           // stock symbol, null for others
        private BigDecimal units;            // shares held at time of dividend
        private UUID       accountId;
        private String     accountName;
        private boolean    investmentActive; // false = investment was deleted/sold
        private boolean    credited;         // true = income entry exists (credited to account); false = history-only display
    }
}
