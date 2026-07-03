package com.wealthynest.domain.category.mapper;

import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.entity.Category;
import org.mapstruct.BeanMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import java.util.List;

@Mapper(componentModel = "spring")
public interface CategoryMapper {
    @Mapping(target = "type",   expression = "java(category.getType().name())")
    @Mapping(target = "system", source = "system")
    @Mapping(target = "userId", source = "userId")
    CategoryResponse toResponse(Category category);

    List<CategoryResponse> toResponseList(List<Category> categories);

    @BeanMapping(builder = @org.mapstruct.Builder(disableBuilder = true))
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "modifiedBy", ignore = true)
    @Mapping(target = "system", constant = "false")
    @Mapping(target = "familyId", ignore = true)
    Category toEntity(CreateCategoryRequest request);
}
