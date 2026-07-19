package com.wealthynest.domain.asset.mapper;

import com.wealthynest.domain.asset.dto.request.CreateAssetRequest;
import com.wealthynest.domain.asset.dto.response.AssetResponse;
import com.wealthynest.domain.asset.entity.Asset;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AssetMapper {
    @Mapping(target = "assetType", expression = "java(asset.getAssetType().name())")
    @Mapping(target = "active", source = "active")
    AssetResponse toResponse(Asset asset);

    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "modifiedBy", ignore = true)
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "familyId", ignore = true)
    @Mapping(target = "currency", constant = "INR")
    @Mapping(target = "active", constant = "true")
    @Mapping(target = "asOfDate", expression = "java(request.getAsOfDate() != null ? request.getAsOfDate() : java.time.LocalDate.now())")
    Asset toEntity(CreateAssetRequest request);
}
