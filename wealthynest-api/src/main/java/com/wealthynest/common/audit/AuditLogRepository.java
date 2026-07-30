package com.wealthynest.common.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
        SELECT a FROM AuditLog a
        WHERE (:userId IS NULL OR a.userId = :userId)
          AND (:action  IS NULL OR a.action LIKE %:action%)
        ORDER BY a.createdAt DESC
        """)
    Page<AuditLog> findWithFilters(
            @Param("userId") UUID    userId,
            @Param("action")  String action,
            Pageable pageable);

    /** Bulk delete, not fetch-then-remove-one-by-one — see idx_audit_logs_created_at
     * (V51__audit_log_cleanup_job.sql) for why this stays a single index scan even once the table
     * is large. Caller (AuditLogCleanupScheduler) provides its own transaction — @Modifying queries
     * require one active regardless. */
    @Modifying
    @Query("DELETE FROM AuditLog a WHERE a.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") Instant cutoff);
}
