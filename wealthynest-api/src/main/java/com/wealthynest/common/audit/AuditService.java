package com.wealthynest.common.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditLogRepository auditLogRepository;

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(UUID actorId, String action, String entityType, UUID entityId,
                    Map<String, Object> oldValue, Map<String, Object> newValue,
                    String ipAddress, String userAgent) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .userId(actorId)
                    .action(action).entityType(entityType).entityId(entityId)
                    .oldValue(oldValue).newValue(newValue)
                    .ipAddress(ipAddress).userAgent(userAgent).build());
        } catch (Exception e) {
            log.error("Failed to persist audit log for action {}: {}", action, e.getMessage());
        }
    }
}
