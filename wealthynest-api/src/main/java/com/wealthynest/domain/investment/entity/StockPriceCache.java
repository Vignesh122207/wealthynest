package com.wealthynest.domain.investment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "stock_price_cache")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class StockPriceCache {
    @Id
    @Column(length = 30)
    private String symbol;

    @Column(length = 10) @Builder.Default private String exchange = "NSE";
    @Column(name = "company_name",  length = 200) private String companyName;
    @Column(name = "current_price",  precision = 14, scale = 4) private BigDecimal currentPrice;
    @Column(name = "previous_close", precision = 14, scale = 4) private BigDecimal previousClose;
    @Column(name = "day_change",     precision = 14, scale = 4) private BigDecimal dayChange;
    @Column(name = "day_change_pct", precision = 8,  scale = 4) private BigDecimal dayChangePct;
    @Column(name = "week52_high",    precision = 14, scale = 4) private BigDecimal week52High;
    @Column(name = "week52_low",     precision = 14, scale = 4) private BigDecimal week52Low;
    @Column(name = "market_cap",     precision = 20, scale = 2) private BigDecimal marketCap;
    @Column(name = "last_updated") private Instant lastUpdated;
}
