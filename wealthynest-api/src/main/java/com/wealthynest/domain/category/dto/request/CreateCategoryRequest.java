package com.wealthynest.domain.category.dto.request;

import com.wealthynest.domain.category.entity.CategoryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class CreateCategoryRequest {
    @NotBlank @Size(min = 2, max = 80)
    private String name;
    @Size(max = 50)
    private String icon;
    @Size(max = 7)
    private String color;
    @NotNull
    private CategoryType type;
}
