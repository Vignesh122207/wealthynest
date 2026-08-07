package com.wealthynest.domain.debt.service;

import com.wealthynest.domain.debt.dto.request.CreateDebtRequest;
import com.wealthynest.domain.debt.dto.request.RecordPaymentRequest;
import com.wealthynest.domain.debt.dto.request.UpdateDebtRequest;
import com.wealthynest.domain.debt.dto.response.DebtRecordResponse;
import com.wealthynest.domain.debt.entity.DebtType;
import java.util.List;
import java.util.UUID;

public interface DebtService {
    List<DebtRecordResponse> getAll(UUID userId);
    List<DebtRecordResponse> getByType(UUID userId, DebtType type);
    DebtRecordResponse       create(UUID userId, CreateDebtRequest request);
    DebtRecordResponse       update(UUID id, UUID userId, UpdateDebtRequest request);
    DebtRecordResponse       recordPayment(UUID id, UUID userId, RecordPaymentRequest request);
    DebtRecordResponse       deletePayment(UUID id, UUID paymentId, UUID userId);
    DebtRecordResponse       settle(UUID id, UUID userId);
    void                     delete(UUID id, UUID userId);
}
