package com.wealthynest.domain.category.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.UUID;

/**
 * Shared IDOR guard for services that accept a category id as a foreign reference
 * (expense/budget) — a category is usable if it's a system category, or belongs to the
 * caller's own user/family scope; anything else is treated as not belonging to the caller.
 */
@Component
@RequiredArgsConstructor
public class CategoryOwnershipGuard {
    private final CategoryRepository categoryRepository;

    public void validateCategoryOwnership(UUID categoryId, UUID userId, UUID familyId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId));
        // Archived (soft-deleted) categories keep labelling old expenses but can't take new ones
        if (category.isArchived()) throw new ResourceNotFoundException("Category", "id", categoryId);
        boolean allowed = category.isSystem()
                || (userId   != null && userId.equals(category.getUserId()))
                || (familyId != null && familyId.equals(category.getFamilyId()));
        if (!allowed) throw new AccessDeniedException("Category does not belong to you");
    }
}
