package com.wealthynest.infra.scheduler;

import com.wealthynest.common.audit.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogCleanupSchedulerTest {

    @Mock private AuditLogRepository auditLogRepository;

    private AuditLogCleanupScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new AuditLogCleanupScheduler(auditLogRepository);
    }

    /** Within a few seconds of the expected cutoff — avoids a flaky exact-instant match against
     * the scheduler's own Instant.now() call. */
    private void assertCutoffNearNow(Instant actual, int retentionDays) {
        Instant expected = Instant.now().minus(retentionDays, ChronoUnit.DAYS);
        assertThat(Duration.between(expected, actual).abs()).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    void deletesRowsOlderThanTheConfiguredRetentionWindow() {
        ReflectionTestUtils.setField(scheduler, "retentionDays", 180);
        when(auditLogRepository.deleteByCreatedAtBefore(any())).thenReturn(42);

        scheduler.purgeOldEntries();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(auditLogRepository).deleteByCreatedAtBefore(cutoffCaptor.capture());
        assertCutoffNearNow(cutoffCaptor.getValue(), 180);
    }

    @Test
    void usesTheConfiguredRetentionDaysNotAHardcodedDefault() {
        ReflectionTestUtils.setField(scheduler, "retentionDays", 30);
        when(auditLogRepository.deleteByCreatedAtBefore(any())).thenReturn(0);

        scheduler.purgeOldEntries();

        ArgumentCaptor<Instant> cutoffCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(auditLogRepository).deleteByCreatedAtBefore(cutoffCaptor.capture());
        assertCutoffNearNow(cutoffCaptor.getValue(), 30);
    }
}
