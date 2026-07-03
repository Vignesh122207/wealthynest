package com.wealthynest.domain.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "support_tickets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SupportTicket {

    public enum Status   { OPEN, IN_PROGRESS, RESOLVED, CLOSED }
    public enum Priority { LOW, MEDIUM, HIGH, URGENT }
    public enum Category { BUG_REPORT, FEATURE_REQUEST, ACCOUNT_ISSUE, DATA_SYNC_ISSUE, GENERAL_QUESTION }

    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String subject;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "ticket_category")
    @Builder.Default
    private Category category = Category.GENERAL_QUESTION;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "ticket_status")
    @Builder.Default
    private Status status = Status.OPEN;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "ticket_priority")
    @Builder.Default
    private Priority priority = Priority.MEDIUM;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
