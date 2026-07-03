package com.wealthynest.domain.asset.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class AssetResponse {
    private UUID id;
    private String name;
    private String assetType;
    private BigDecimal currentValue;
    private String currency;
    private String institution;
    private String accountNumber;
    private String notes;
    private boolean active;
    private LocalDate asOfDate;
    private Instant createdAt;
    private Instant updatedAt;
}
