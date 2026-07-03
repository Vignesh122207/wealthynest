package com.wealthynest.domain.asset.service;

import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface AssetService {
    AssetResponse createAsset(UUID userId, UUID familyId, CreateAssetRequest request);
    AssetResponse updateAsset(UUID assetId, UUID userId, CreateAssetRequest request);
    void deleteAsset(UUID assetId, UUID userId);
    List<AssetResponse> getAssets(UUID userId, UUID familyId);
    BigDecimal getTotalNetWorth(UUID userId, UUID familyId);
    BigDecimal getFamilyNetWorth(UUID familyId);
}
