package com.wealthynest.domain.admin.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

import java.time.Instant;

/** Singleton row (id is always TRUE) holding system-wide, admin-controlled feature toggles. */
@Entity
@Table(name = "system_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SystemSetting {

    public static final Boolean SINGLETON_ID = Boolean.TRUE;

    @Id
    @Column(name = "id")
    @Builder.Default
    private Boolean id = SINGLETON_ID;

    @Column(name = "login_alert_email_enabled", nullable = false)
    @Builder.Default
    private boolean loginAlertEmailEnabled = true;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
