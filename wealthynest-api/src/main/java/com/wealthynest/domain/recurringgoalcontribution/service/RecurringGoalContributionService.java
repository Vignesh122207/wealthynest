package com.wealthynest.domain.recurringgoalcontribution.service;

import com.wealthynest.domain.recurringgoalcontribution.dto.request.CreateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.response.RecurringGoalContributionResponse;
import java.util.List;
import java.util.UUID;

public interface RecurringGoalContributionService {
    List<RecurringGoalContributionResponse> getAll(UUID userId);
    RecurringGoalContributionResponse       create(UUID userId, CreateRecurringGoalContributionRequest request);
    RecurringGoalContributionResponse       update(UUID id, UUID userId, UpdateRecurringGoalContributionRequest request);
    RecurringGoalContributionResponse       toggleActive(UUID id, UUID userId);
    void                                    delete(UUID id, UUID userId);
    void                                    processScheduled();
}
