package com.wealthynest.domain.income.service;

import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.dto.request.UpdateIncomeRequest;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import java.util.List;
import java.util.UUID;

public interface IncomeService {
    IncomeResponse       create(UUID userId, CreateIncomeRequest request);
    IncomeResponse       update(UUID id, UUID userId, UpdateIncomeRequest request);
    List<IncomeResponse> getAll(UUID userId);
    List<IncomeResponse> getAll(UUID userId, boolean includeDebt);
    List<IncomeResponse> getByYear(UUID userId, int year);
    List<IncomeResponse> getByPeriod(UUID userId, int year, int month);
    List<IncomeResponse> getByPeriod(UUID userId, int year, int month, boolean includeDebt);
    void                 delete(UUID id, UUID userId);
}
