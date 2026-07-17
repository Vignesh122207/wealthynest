package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * Local mirror of mfapi.in's full scheme list — lets MF search query Postgres instead of proxying
 * live to the external API on every keystroke. Kept current by MfMasterSyncScheduler (weekly full
 * refresh, same rhythm as StockMaster's NSE/BSE sync).
 */
@Entity
@Table(name = "mf_master")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MfMaster {

    @Id
    @Column(name = "scheme_code", length = 20)
    private String schemeCode;

    @Column(name = "scheme_name", nullable = false, length = 500)
    private String schemeName;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PreUpdate @PrePersist
    void onSave() { updatedAt = Instant.now(); }
}
