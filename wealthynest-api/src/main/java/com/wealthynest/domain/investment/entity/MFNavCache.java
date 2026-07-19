package com.wealthynest.domain.investment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "mf_nav_cache")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MFNavCache {
    @Id
    @Column(name = "scheme_code", length = 20)
    private String schemeCode;

    @Column(name = "scheme_name", length = 500) private String schemeName;
    @Column(name = "fund_house",  length = 200) private String fundHouse;
    @Column(precision = 14, scale = 4) private BigDecimal nav;
    @Column(name = "nav_date") private LocalDate navDate;
    @Column(name = "last_updated") private Instant lastUpdated;
}
