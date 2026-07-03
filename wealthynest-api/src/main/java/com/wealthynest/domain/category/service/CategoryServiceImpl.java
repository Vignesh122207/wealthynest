package com.wealthynest.domain.category.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.request.UpdateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.mapper.CategoryMapper;
import com.wealthynest.domain.category.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {
    private final CategoryRepository categoryRepository;
    private final CategoryMapper     categoryMapper;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "categories", key = "#familyId != null ? 'family_' + #familyId : 'user_' + #userId")
    public List<CategoryResponse> getCategories(UUID userId, UUID familyId) {
        if (familyId != null) return categoryMapper.toResponseList(categoryRepository.findByFamilyIdOrSystem(familyId));
        if (userId   != null) return categoryMapper.toResponseList(categoryRepository.findByUserIdOrSystem(userId));
        return categoryMapper.toResponseList(categoryRepository.findBySystemTrue());
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public CategoryResponse createCategory(UUID userId, UUID familyId, CreateCategoryRequest request) {
        Category category = categoryMapper.toEntity(request);
        if (familyId != null) category.setFamilyId(familyId);
        else                  category.setUserId(userId);
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public CategoryResponse updateCategory(UUID categoryId, UUID userId, UUID familyId, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId));
        if (category.isSystem()) {
            throw new BusinessException("System categories cannot be edited", HttpStatus.FORBIDDEN);
        }
        boolean ownedByFamily = familyId != null && familyId.equals(category.getFamilyId());
        boolean ownedByUser   = userId   != null && userId.equals(category.getUserId());
        if (!ownedByFamily && !ownedByUser) {
            throw new AccessDeniedException("Category does not belong to you");
        }
        if (request.getName()  != null) category.setName(request.getName());
        if (request.getIcon()  != null) category.setIcon(request.getIcon());
        if (request.getColor() != null) category.setColor(request.getColor());
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public void deleteCategory(UUID categoryId, UUID userId, UUID familyId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId));
        if (category.isSystem()) {
            throw new BusinessException("System categories cannot be deleted", HttpStatus.FORBIDDEN);
        }
        boolean ownedByFamily = familyId != null && familyId.equals(category.getFamilyId());
        boolean ownedByUser   = userId   != null && userId.equals(category.getUserId());
        if (!ownedByFamily && !ownedByUser) {
            throw new AccessDeniedException("Category does not belong to you");
        }
        categoryRepository.delete(category);
    }
}
