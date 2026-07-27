package com.wealthynest.domain.goal.service;

import com.wealthynest.domain.goal.dto.request.CreateGoalRequest;
import com.wealthynest.domain.goal.dto.request.UpdateGoalRequest;
import com.wealthynest.domain.goal.dto.response.GoalResponse;
import java.util.List;
import java.util.UUID;

public interface GoalService {
    List<GoalResponse> getAll(UUID userId, UUID familyId);
    GoalResponse       create(UUID userId, UUID familyId, CreateGoalRequest request);
    GoalResponse       update(UUID id, UUID userId, UUID familyId, UpdateGoalRequest request);
    void               delete(UUID id, UUID userId, UUID familyId);
}
