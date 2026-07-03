package com.wealthynest.domain.expense.mapper;

import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.entity.Expense;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ExpenseMapper {
    @Mapping(target = "paymentMethod", expression = "java(expense.getPaymentMethod() != null ? expense.getPaymentMethod().name() : null)")
    @Mapping(target = "recurring", source = "recurring")
    @Mapping(target = "debt", source = "debt")
    @Mapping(target = "categoryName", ignore = true)
    @Mapping(target = "categoryIcon", ignore = true)
    @Mapping(target = "categoryColor", ignore = true)
    ExpenseResponse toResponse(Expense expense);

    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "modifiedBy", ignore = true)
    @Mapping(target = "userId", ignore = true)
    @Mapping(target = "familyId", ignore = true)
    @Mapping(target = "currency", constant = "INR")
    Expense toEntity(CreateExpenseRequest request);
}
