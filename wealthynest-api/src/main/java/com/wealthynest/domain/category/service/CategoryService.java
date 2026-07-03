package com.wealthynest.domain.category.service;

import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.request.UpdateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import java.util.List;
import java.util.UUID;

public interface CategoryService {
    List<CategoryResponse> getCategories(UUID userId, UUID familyId);
    CategoryResponse       createCategory(UUID userId, UUID familyId, CreateCategoryRequest request);
    CategoryResponse       updateCategory(UUID categoryId, UUID userId, UUID familyId, UpdateCategoryRequest request);
    void                   deleteCategory(UUID categoryId, UUID userId, UUID familyId);
}
