package com.wealthynest.domain.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device_tokens")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DeviceToken {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false, unique = true)    private String token;
    @Column(nullable = false, length = 20)      @Builder.Default private String platform = "ANDROID";
    @Column(name = "created_at", updatable = false, nullable = false)
    @Builder.Default private Instant createdAt = Instant.now();
    @Column(name = "last_seen_at", nullable = false)
    @Builder.Default private Instant lastSeenAt = Instant.now();
}
