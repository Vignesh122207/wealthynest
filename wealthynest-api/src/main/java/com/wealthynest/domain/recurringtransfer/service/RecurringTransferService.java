package com.wealthynest.domain.recurringtransfer.service;

import com.wealthynest.domain.recurringtransfer.dto.request.CreateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.response.RecurringTransferResponse;
import java.util.List;
import java.util.UUID;

public interface RecurringTransferService {
    List<RecurringTransferResponse> getAll(UUID userId);
    RecurringTransferResponse       create(UUID userId, CreateRecurringTransferRequest request);
    RecurringTransferResponse       update(UUID id, UUID userId, UpdateRecurringTransferRequest request);
    RecurringTransferResponse       toggleActive(UUID id, UUID userId);
    void                            delete(UUID id, UUID userId);
    void                            processScheduled();
}
