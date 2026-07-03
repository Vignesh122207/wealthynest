package com.wealthynest.domain.investment.mapper;

import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.entity.Investment;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.util.List;

@Mapper(componentModel = "spring")
public interface InvestmentMapper {

    @Mapping(target = "investmentType", expression = "java(inv.getInvestmentType().name())")
    @Mapping(target = "gainLoss",            ignore = true)
    @Mapping(target = "gainLossPct",         ignore = true)
    @Mapping(target = "livePrice",           ignore = true)
    @Mapping(target = "dayChange",           ignore = true)
    @Mapping(target = "dayChangePct",        ignore = true)
    @Mapping(target = "week52High",          ignore = true)
    @Mapping(target = "week52Low",           ignore = true)
    @Mapping(target = "priceLastUpdated",    ignore = true)
    @Mapping(target = "maturityAmount",      ignore = true)
    @Mapping(target = "accruedInterest",     ignore = true)
    @Mapping(target = "couponCreditDay",     source = "couponCreditDay")
    @Mapping(target = "active",              source = "active")
    InvestmentResponse toResponse(Investment inv);

    List<InvestmentResponse> toResponseList(List<Investment> list);

    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id",          ignore = true)
    @Mapping(target = "createdAt",   ignore = true)
    @Mapping(target = "updatedAt",   ignore = true)
    @Mapping(target = "createdBy",   ignore = true)
    @Mapping(target = "modifiedBy",  ignore = true)
    @Mapping(target = "userId",      ignore = true)
    @Mapping(target = "assetId",     ignore = true)
    @Mapping(target = "active",      ignore = true)
    Investment toEntity(CreateInvestmentRequest request);
}
