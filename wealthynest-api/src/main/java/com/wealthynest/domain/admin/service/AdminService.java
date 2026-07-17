package com.wealthynest.domain.admin.service;

import com.wealthynest.common.audit.AuditLogResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.UserRole;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AdminService {
    Map<String, Long> getStats();
    List<Map<String, Object>> getUserGrowth();
    PagedResponse<UserResponse> listUsers(Pageable pageable, String search);
    UserResponse toggleActive(UUID targetId, UUID actorId, String ipAddress, String userAgent);
    UserResponse updateRole(UUID targetId, UserRole role, UUID actorId, String ipAddress, String userAgent);
    /** Triggers the forced-reset email and returns the target user's email for the confirmation message. */
    String resetPassword(UUID targetId, UUID actorId, String ipAddress, String userAgent);
    UserResponse anonymizeUser(UUID targetId, UUID actorId, String ipAddress, String userAgent);
    PagedResponse<AuditLogResponse> getAuditLogs(Pageable pageable, UUID userId, String action);
}
