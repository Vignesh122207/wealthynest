package com.wealthynest.domain.asset.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.mapper.AssetMapper;
import com.wealthynest.domain.asset.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssetServiceImpl implements AssetService {
    private final AssetRepository    assetRepository;
    private final AssetMapper        assetMapper;

    @Override @Transactional
    public AssetResponse createAsset(UUID userId, UUID familyId, CreateAssetRequest request) {
        Asset asset = assetMapper.toEntity(request);
        asset.setUserId(userId);
        asset.setFamilyId(familyId);
        return assetMapper.toResponse(assetRepository.save(asset));
    }

    @Override @Transactional
    public AssetResponse updateAsset(UUID assetId, UUID userId, CreateAssetRequest request) {
        Asset asset = findAndValidate(assetId, userId);
        asset.setName(request.getName());
        asset.setAssetType(request.getAssetType());
        asset.setCurrentValue(request.getCurrentValue());
        asset.setInstitution(request.getInstitution());
        asset.setAccountNumber(request.getAccountNumber());
        asset.setNotes(request.getNotes());
        asset.setAsOfDate(request.getAsOfDate() != null ? request.getAsOfDate() : LocalDate.now());
        return assetMapper.toResponse(assetRepository.save(asset));
    }

    @Override @Transactional
    public void deleteAsset(UUID assetId, UUID userId) {
        Asset asset = findAndValidate(assetId, userId);
        asset.setActive(false);
        assetRepository.save(asset);
    }

    @Override @Transactional(readOnly = true)
    public List<AssetResponse> getAssets(UUID userId, UUID familyId) {
        // Always personal — the family tab uses /families/{id}/net-worth for combined view.
        // No investment-linked exclusion needed anymore — Investment no longer owns an Asset row.
        return assetRepository.findByUserIdAndActiveTrue(userId).stream()
                .map(assetMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal getTotalNetWorth(UUID userId, UUID familyId) {
        // Always personal net worth — combined family net worth is via /families/{id}/net-worth
        return assetRepository.sumCurrentValueByUser(userId);
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal getFamilyNetWorth(UUID familyId) {
        return assetRepository.sumCurrentValueByFamily(familyId);
    }

    private Asset findAndValidate(UUID assetId, UUID userId) {
        Asset asset = assetRepository.findById(assetId)
                .orElseThrow(() -> new ResourceNotFoundException("Asset", "id", assetId));
        if (!asset.getUserId().equals(userId)) throw new AccessDeniedException();
        return asset;
    }
}
