package com.wealthynest.infra.scheduler;

import com.wealthynest.common.audit.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Purges audit_logs rows past the retention window — this table only ever grows (every login,
 * password change, Google sign-in, admin action, etc. writes one row and nothing else ever
 * deletes them), so left alone it grows unbounded forever. Postgres itself has no native
 * per-row TTL (unlike e.g. DynamoDB); a scheduled bulk DELETE is the standard way to bound this,
 * matching how every other recurring job in this app already works (JobSchedulerService,
 * AUDIT_LOG_CLEANUP job — admin-configurable/triggerable like the rest).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditLogCleanupScheduler {

    private final AuditLogRepository auditLogRepository;

    @Value("${wealthynest.audit.retention-days:180}")
    private int retentionDays;

    /** Entry point called by JobSchedulerService (AUDIT_LOG_CLEANUP job). */
    @Transactional
    public void purgeOldEntries() {
        Instant cutoff = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        int deleted = auditLogRepository.deleteByCreatedAtBefore(cutoff);
        log.info("Audit log cleanup: purged {} entries older than {} days", deleted, retentionDays);
    }
}
