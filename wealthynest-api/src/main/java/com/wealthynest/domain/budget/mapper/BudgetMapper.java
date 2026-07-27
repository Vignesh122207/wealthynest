package com.wealthynest.domain.budget.mapper;

import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.entity.Budget;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface BudgetMapper {
    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id",            ignore = true)
    @Mapping(target = "createdAt",     ignore = true)
    @Mapping(target = "updatedAt",     ignore = true)
    @Mapping(target = "createdBy",     ignore = true)
    @Mapping(target = "modifiedBy",    ignore = true)
    @Mapping(target = "familyId",      ignore = true)
    @Mapping(target = "userId",        ignore = true)
    @Mapping(target = "alertThreshold", defaultExpression = "java(new java.math.BigDecimal(\"80.00\"))")
    @Mapping(target = "budgetType",    defaultExpression = "java(com.wealthynest.domain.budget.entity.BudgetType.MONTHLY)")
    Budget toEntity(CreateBudgetRequest request);

    @Mapping(target = "categoryName",  ignore = true)
    @Mapping(target = "categoryIcon",  ignore = true)
    @Mapping(target = "categoryColor", ignore = true)
    @Mapping(target = "spent",         ignore = true)
    @Mapping(target = "remaining",     ignore = true)
    @Mapping(target = "percentUsed",   ignore = true)
    @Mapping(target = "overBudget",    ignore = true)
    @Mapping(target = "alertTriggered",ignore = true)
    @Mapping(target = "rolloverAmount", ignore = true)
    @Mapping(target = "shared", expression = "java(budget.getFamilyId() != null)")
    BudgetResponse toResponse(Budget budget);
}
