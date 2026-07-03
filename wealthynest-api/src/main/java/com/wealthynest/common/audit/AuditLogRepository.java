package com.wealthynest.common.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

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
}
