package com.wealthynest.domain.category.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.request.UpdateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryService categoryService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getCategories() {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.ok(ApiResponse.success(categoryService.getCategories(userId, familyId)));
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(
            @Valid @RequestBody CreateCategoryRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(categoryService.createCategory(userId, familyId, request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CategoryResponse>> updateCategory(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCategoryRequest request) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        return ResponseEntity.ok(ApiResponse.success(
                categoryService.updateCategory(id, userId, familyId, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable UUID id) {
        UUID userId   = SecurityUtils.requireCurrentUserId();
        UUID familyId = SecurityUtils.getCurrentFamilyId().orElse(null);
        categoryService.deleteCategory(id, userId, familyId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}
