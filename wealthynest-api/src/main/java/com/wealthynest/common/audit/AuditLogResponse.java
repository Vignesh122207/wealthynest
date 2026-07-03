package com.wealthynest.common.audit;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class AuditLogResponse {
    private UUID                id;
    private UUID                userId;
    private String              userEmail;
    private String              action;
    private String              entityType;
    private UUID                entityId;
    private Map<String, Object> oldValue;
    private Map<String, Object> newValue;
    private String              ipAddress;
    private Instant             createdAt;

    public static AuditLogResponse from(AuditLog log, String userEmail) {
        return AuditLogResponse.builder()
                .id(log.getId())
                .userId(log.getUserId())
                .userEmail(userEmail)
                .action(log.getAction())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .oldValue(log.getOldValue())
                .newValue(log.getNewValue())
                .ipAddress(log.getIpAddress())
                .createdAt(log.getCreatedAt())
                .build();
    }
}
