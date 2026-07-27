package com.wealthynest.domain.notification.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.notification.dto.request.RegisterDeviceTokenRequest;
import com.wealthynest.domain.notification.dto.request.UpdateNotificationPreferenceRequest;
import com.wealthynest.domain.notification.dto.response.NotificationPreferenceResponse;
import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import com.wealthynest.domain.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<NotificationResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(PagedResponse.of(notificationService.getNotifications(
                SecurityUtils.requireCurrentUserId(),
                PageRequest.of(page, size, Sort.by("createdAt").descending()))));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount() {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getUnreadCount(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping("/mark-all-read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markAllRead() {
        notificationService.markAllRead(SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable UUID id) {
        notificationService.markRead(SecurityUtils.requireCurrentUserId(), id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        notificationService.delete(SecurityUtils.requireCurrentUserId(), id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/preferences")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> getPreferences() {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getPreferences(SecurityUtils.requireCurrentUserId())));
    }

    @PutMapping("/preferences")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> updatePreferences(
            @Valid @RequestBody UpdateNotificationPreferenceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.updatePreferences(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PostMapping("/device-tokens")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> registerDeviceToken(@Valid @RequestBody RegisterDeviceTokenRequest request) {
        notificationService.registerDeviceToken(SecurityUtils.requireCurrentUserId(), request.getToken());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @DeleteMapping("/device-tokens")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> unregisterDeviceToken(@RequestParam String token) {
        notificationService.unregisterDeviceToken(token);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
