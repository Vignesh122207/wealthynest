package com.wealthynest.domain.admin.controller;

import com.wealthynest.common.audit.AuditLogResponse;
import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.service.AdminService;
import com.wealthynest.domain.admin.service.JobSchedulerService;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService        adminService;
    private final JobSchedulerService jobSchedulerService;

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getStats()));
    }

    @GetMapping("/user-growth")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getUserGrowth() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserGrowth()));
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<PagedResponse<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "20") int    size,
            @RequestParam(required = false)    String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.listUsers(pageable, search));
    }

    @PatchMapping("/users/{id}/toggle-active")
    public ResponseEntity<ApiResponse<UserResponse>> toggleActive(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        UserResponse saved = adminService.toggleActive(id, actorId, request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(
            @PathVariable UUID id, @RequestParam UserRole role, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        UserResponse saved = adminService.updateRole(id, role, actorId, request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        String email = adminService.resetPassword(id, actorId, request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success("Password reset email sent to " + email));
    }

    @PostMapping("/users/{id}/anonymize")
    public ResponseEntity<ApiResponse<UserResponse>> anonymizeUser(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        UserResponse saved = adminService.anonymizeUser(id, actorId, request.getRemoteAddr(), request.getHeader("User-Agent"));
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public ResponseEntity<PagedResponse<AuditLogResponse>> getAuditLogs(
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "20") int    size,
            @RequestParam(required = false)    UUID   userId,
            @RequestParam(required = false)    String action) {
        PageRequest pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(adminService.getAuditLogs(pageable, userId, action));
    }

    // ── Jobs ──────────────────────────────────────────────────────────────────

    @GetMapping("/jobs")
    public ResponseEntity<ApiResponse<List<JobScheduleConfig>>> listJobs() {
        return ResponseEntity.ok(ApiResponse.success(jobSchedulerService.getAllConfigs()));
    }

    @PostMapping("/jobs/{jobName}/trigger")
    public ResponseEntity<ApiResponse<String>> triggerJob(@PathVariable String jobName) {
        jobSchedulerService.triggerNow(jobName);
        return ResponseEntity.ok(ApiResponse.success("Job " + jobName + " triggered successfully"));
    }

    @PutMapping("/jobs/{jobName}/schedule")
    public ResponseEntity<ApiResponse<JobScheduleConfig>> updateSchedule(
            @PathVariable String jobName,
            @RequestParam String cron) {
        return ResponseEntity.ok(ApiResponse.success(
            jobSchedulerService.updateSchedule(jobName, cron)));
    }
}
