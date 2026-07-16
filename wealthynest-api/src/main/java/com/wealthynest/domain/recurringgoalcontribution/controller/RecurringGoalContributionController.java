package com.wealthynest.domain.recurringgoalcontribution.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.CreateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.response.RecurringGoalContributionResponse;
import com.wealthynest.domain.recurringgoalcontribution.service.RecurringGoalContributionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/recurring-goal-contribution")
@RequiredArgsConstructor
public class RecurringGoalContributionController {

    private final RecurringGoalContributionService recurringGoalContributionService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<RecurringGoalContributionResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
                recurringGoalContributionService.getAll(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringGoalContributionResponse>> create(
            @Valid @RequestBody CreateRecurringGoalContributionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(
                        recurringGoalContributionService.create(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringGoalContributionResponse>> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateRecurringGoalContributionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringGoalContributionService.update(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RecurringGoalContributionResponse>> toggle(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringGoalContributionService.toggleActive(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        recurringGoalContributionService.delete(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
