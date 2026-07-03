package com.wealthynest.domain.category.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;

@Getter
public class UpdateCategoryRequest {
    @Size(min = 2, max = 80)
    private String name;
    @Size(max = 50)
    private String icon;
    @Size(max = 7)
    private String color;
}
