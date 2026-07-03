package com.wealthynest.domain.admin.controller;

import com.wealthynest.common.audit.AuditLogRepository;
import com.wealthynest.common.audit.AuditLogResponse;
import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.service.JobSchedulerService;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.common.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository         userRepository;
    private final UserMapper             userMapper;
    private final JobSchedulerService    jobSchedulerService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthService            authService;
    private final AuditLogRepository     auditLogRepository;
    private final AuditService           auditService;

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats() {
        long total    = userRepository.count();
        long active   = userRepository.countByActiveTrue();
        long admins   = userRepository.countByRole(UserRole.ADMIN);
        long members  = userRepository.countByRole(UserRole.MEMBER);
        LocalDate now = LocalDate.now();
        long newThisMonth = userRepository.countNewUsersInMonth(now.getYear(), now.getMonthValue());
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("totalUsers",       total);
        stats.put("activeUsers",      active);
        stats.put("inactiveUsers",    total - active);
        stats.put("adminUsers",       admins);
        stats.put("memberUsers",      members);
        stats.put("newUsersThisMonth", newThisMonth);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @GetMapping("/user-growth")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getUserGrowth() {
        Instant startDate = LocalDate.now().minusMonths(11).withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        List<Object[]> rows = userRepository.countNewUsersByMonth(startDate);
        List<Map<String, Object>> result = rows.stream()
            .map(r -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("month", r[0].toString());
                m.put("count", ((Number) r[1]).longValue());
                return m;
            })
            .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<PagedResponse<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "20") int    size,
            @RequestParam(required = false)    String search) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<UserResponse> result = StringUtils.hasText(search)
                ? userRepository.search(search.trim(), pageable).map(userMapper::toResponse)
                : userRepository.findAll(pageable).map(userMapper::toResponse);
        return ResponseEntity.ok(PagedResponse.of(result));
    }

    @Transactional
    @PatchMapping("/users/{id}/toggle-active")
    public ResponseEntity<ApiResponse<UserResponse>> toggleActive(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        return userRepository.findById(id).map(user -> {
            boolean deactivating = user.isActive();
            String  targetEmail  = user.getEmail();
            user.setActive(!deactivating);
            UserResponse saved = userMapper.toResponse(userRepository.save(user));
            if (deactivating) {
                refreshTokenRepository.revokeAllByUserId(id);
            }
            auditService.log(
                actorId,
                deactivating ? "USER_DEACTIVATED" : "USER_ACTIVATED",
                "USER", id,
                Map.of("active", deactivating,  "email", targetEmail),
                Map.of("active", !deactivating, "email", targetEmail),
                request.getRemoteAddr(),
                request.getHeader("User-Agent")
            );
            return ResponseEntity.ok(ApiResponse.success(saved));
        }).orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<ApiResponse<UserResponse>> updateRole(
            @PathVariable UUID id, @RequestParam UserRole role, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        return userRepository.findById(id).map(user -> {
            String previousRole = user.getRole().name();
            String targetEmail  = user.getEmail();
            user.setRole(role);
            UserResponse saved = userMapper.toResponse(userRepository.save(user));
            auditService.log(
                actorId,
                "USER_ROLE_CHANGED",
                "USER", id,
                Map.of("role", previousRole, "email", targetEmail),
                Map.of("role", role.name(),  "email", targetEmail),
                request.getRemoteAddr(),
                request.getHeader("User-Agent")
            );
            return ResponseEntity.ok(ApiResponse.success(saved));
        }).orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    @PostMapping("/users/{id}/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        String email = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id))
                .getEmail();
        ForgotPasswordRequest req = new ForgotPasswordRequest();
        req.setEmail(email);
        authService.forgotPassword(req);
        auditService.log(
            actorId,
            "USER_PASSWORD_RESET_FORCED",
            "USER", id,
            null, Map.of("email", email),
            request.getRemoteAddr(),
            request.getHeader("User-Agent")
        );
        return ResponseEntity.ok(ApiResponse.success("Password reset email sent to " + email));
    }

    @Transactional
    @PostMapping("/users/{id}/anonymize")
    public ResponseEntity<ApiResponse<UserResponse>> anonymizeUser(
            @PathVariable UUID id, HttpServletRequest request) {
        UUID actorId = SecurityUtils.getCurrentUserId().orElse(null);
        return userRepository.findById(id).map(user -> {
            String previousEmail = user.getEmail();
            user.setFullName("[Deleted User]");
            user.setEmail("deleted-" + id.toString().substring(0, 8) + "@removed.invalid");
            user.setActive(false);
            refreshTokenRepository.revokeAllByUserId(id);
            UserResponse saved = userMapper.toResponse(userRepository.save(user));
            auditService.log(
                actorId, "USER_ANONYMIZED", "USER", id,
                Map.of("email", previousEmail),
                Map.of("email", user.getEmail()),
                request.getRemoteAddr(), request.getHeader("User-Agent")
            );
            return ResponseEntity.ok(ApiResponse.success(saved));
        }).orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    @GetMapping("/audit-logs")
    public ResponseEntity<PagedResponse<AuditLogResponse>> getAuditLogs(
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "20") int    size,
            @RequestParam(required = false)    UUID   userId,
            @RequestParam(required = false)    String action) {
        PageRequest pageable = PageRequest.of(page, size);

        boolean hasFilter = userId != null || org.springframework.util.StringUtils.hasText(action);
        var logs = hasFilter
                ? auditLogRepository.findWithFilters(userId, action, pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);

        var userIds = logs.stream()
                .map(l -> l.getUserId())
                .filter(uid -> uid != null)
                .distinct()
                .toList();
        Map<UUID, String> emailMap = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                    .collect(java.util.stream.Collectors.toMap(u -> u.getId(), u -> u.getEmail()));

        var result = logs.map(l -> AuditLogResponse.from(l, l.getUserId() != null
                ? emailMap.getOrDefault(l.getUserId(), "unknown")
                : "system"));
        return ResponseEntity.ok(PagedResponse.of(result));
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
