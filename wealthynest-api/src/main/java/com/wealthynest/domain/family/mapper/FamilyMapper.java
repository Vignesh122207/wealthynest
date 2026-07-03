package com.wealthynest.domain.family.mapper;

import com.wealthynest.domain.family.dto.response.FamilyResponse;
import com.wealthynest.domain.family.entity.Family;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface FamilyMapper {
    FamilyResponse toResponse(Family family);
}
