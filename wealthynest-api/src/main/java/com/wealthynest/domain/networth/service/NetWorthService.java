package com.wealthynest.domain.networth.service;

import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface NetWorthService {
    NetWorthSummaryResponse getSummary(UUID userId, UUID familyId);
    BigDecimal getFamilyNetWorth(UUID familyId);
    void saveSnapshot(UUID userId, BigDecimal netWorth, int year, int month);
    List<NetWorthSnapshot> getHistory(UUID userId);
}
