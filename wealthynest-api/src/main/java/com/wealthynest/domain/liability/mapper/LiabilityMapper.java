package com.wealthynest.domain.liability.mapper;

import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.entity.Liability;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.util.List;

@Mapper(componentModel = "spring")
public interface LiabilityMapper {

    @Mapping(target = "liabilityType", expression = "java(liability.getLiabilityType().name())")
    @Mapping(target = "active", source = "active")
    LiabilityResponse toResponse(Liability liability);

    List<LiabilityResponse> toResponseList(List<Liability> liabilities);

    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id",         ignore = true)
    @Mapping(target = "userId",     ignore = true)
    @Mapping(target = "familyId",   ignore = true)
    @Mapping(target = "createdAt",  ignore = true)
    @Mapping(target = "updatedAt",  ignore = true)
    @Mapping(target = "createdBy",  ignore = true)
    @Mapping(target = "modifiedBy", ignore = true)
    @Mapping(target = "active",     constant = "true")
    Liability toEntity(CreateLiabilityRequest request);
}
