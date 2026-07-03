package com.wealthynest.domain.liability.service;

import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface LiabilityService {
    LiabilityResponse createLiability(UUID userId, UUID familyId, CreateLiabilityRequest request);
    LiabilityResponse updateLiability(UUID id, UUID userId, CreateLiabilityRequest request);
    void              deleteLiability(UUID id, UUID userId);
    List<LiabilityResponse> getLiabilities(UUID userId, UUID familyId);
    BigDecimal        getTotalOutstanding(UUID userId, UUID familyId);
}
