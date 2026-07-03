package com.wealthynest.domain.asset.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "assets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Asset extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "family_id") private UUID familyId;
    @Column(nullable = false, length = 100) private String name;
    @Enumerated(EnumType.STRING)
    @Column(name = "asset_type", nullable = false, length = 30) private AssetType assetType;
    @Column(name = "current_value", nullable = false, precision = 16, scale = 2) private BigDecimal currentValue;
    @Column(nullable = false, length = 3) @Builder.Default private String currency = "INR";
    @Column(length = 100) private String institution;
    @Column(name = "account_number", length = 50) private String accountNumber;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "is_active", nullable = false) @Builder.Default private boolean active = true;
    @Column(name = "as_of_date", nullable = false) private LocalDate asOfDate;
}
