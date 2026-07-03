package com.wealthynest.domain.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false)  private UUID userId;
    @Column(nullable = false, length = 40)       private String type;
    @Column(nullable = false, length = 150)      private String title;
    @Column(nullable = false, columnDefinition = "TEXT") private String message;
    @Column(name = "is_read", nullable = false) @Builder.Default private boolean read = false;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb") private Map<String, Object> metadata;
    @Column(name = "created_at", updatable = false, nullable = false)
    @Builder.Default private Instant createdAt = Instant.now();
}
