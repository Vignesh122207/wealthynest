package com.wealthynest.domain.admin.service;

import com.wealthynest.common.audit.AuditLogResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.domain.admin.dto.response.SystemSettingsResponse;
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
    /** Irreversibly erases the target's account and all their owned financial data (the "permanent
     * erasure" promised on the public delete-account page), as opposed to anonymizeUser which keeps
     * financial records for audit/compliance and only scrubs identity. */
    void deleteUserPermanently(UUID targetId, UUID actorId, String ipAddress, String userAgent);
    PagedResponse<AuditLogResponse> getAuditLogs(Pageable pageable, UUID userId, String action);

    SystemSettingsResponse getSystemSettings();
    /** Global kill switch for the per-login "new sign-in" email — overrides every user's own
     * loginAlertEnabled preference when turned off. */
    SystemSettingsResponse updateSystemSettings(boolean loginAlertEmailEnabled, UUID actorId, String ipAddress, String userAgent);
}
