package com.wealthynest.domain.recurringincome.service;

import com.wealthynest.domain.recurringincome.dto.request.CreateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.response.RecurringIncomeResponse;
import java.util.List;
import java.util.UUID;

public interface RecurringIncomeService {
    List<RecurringIncomeResponse> getAll(UUID userId);
    RecurringIncomeResponse       create(UUID userId, CreateRecurringIncomeRequest request);
    RecurringIncomeResponse       update(UUID id, UUID userId, UpdateRecurringIncomeRequest request);
    RecurringIncomeResponse       toggleActive(UUID id, UUID userId);
    void                          delete(UUID id, UUID userId);
    void                          processScheduled();
}
