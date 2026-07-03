package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "gold_price_cache")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class GoldPriceCache {
    @Id
    private int id = 1;

    @Column(name = "price_18k_per_gram", precision = 10, scale = 2) private BigDecimal price18kPerGram;
    @Column(name = "price_22k_per_gram", precision = 10, scale = 2) private BigDecimal price22kPerGram;
    @Column(name = "price_24k_per_gram", precision = 10, scale = 2) private BigDecimal price24kPerGram;
    @Column(name = "spot_usd_per_oz",    precision = 10, scale = 4) private BigDecimal spotUsdPerOz;
    @Column(name = "usd_inr_rate",       precision = 8,  scale = 4) private BigDecimal usdInrRate;
    @Column(name = "last_updated") private Instant lastUpdated;
}
