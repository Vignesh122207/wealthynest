package com.wealthynest.domain.category.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.request.UpdateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.mapper.CategoryMapper;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
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
    private final ExpenseRepository  expenseRepository;
    private final BudgetRepository   budgetRepository;

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
        // Recreating a previously deleted (archived) category revives the original row instead of
        // inserting a duplicate — its historical expenses reconnect automatically.
        Category revived = categoryRepository
                .findArchivedForRevive(request.getName(), request.getType(), userId, familyId)
                .orElse(null);
        if (revived != null) {
            revived.setArchived(false);
            revived.setName(request.getName());
            if (request.getIcon()  != null) revived.setIcon(request.getIcon());
            if (request.getColor() != null) revived.setColor(request.getColor());
            return categoryMapper.toResponse(categoryRepository.save(revived));
        }

        if (categoryRepository.existsActiveDuplicate(request.getName(), request.getType(), userId, familyId, null)) {
            throw new BusinessException(
                    "A category named \"" + request.getName() + "\" already exists", HttpStatus.CONFLICT);
        }

        Category category = categoryMapper.toEntity(request);
        // Always record the creator; familyId additionally shares it with the family while the
        // creator is a member (and lets it revert to personal if they later leave).
        category.setUserId(userId);
        category.setFamilyId(familyId);
        return categoryMapper.toResponse(categoryRepository.save(category));
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true)
    public CategoryResponse updateCategory(UUID categoryId, UUID userId, UUID familyId, UpdateCategoryRequest request) {
        Category category = findEditableAndValidateOwner(categoryId, userId, familyId, "System categories cannot be edited");
        if (request.getName() != null && !request.getName().equalsIgnoreCase(category.getName())
                && categoryRepository.existsActiveDuplicate(request.getName(), category.getType(), userId, familyId, categoryId)) {
            throw new BusinessException(
                    "A category named \"" + request.getName() + "\" already exists", HttpStatus.CONFLICT);
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
        Category category = findEditableAndValidateOwner(categoryId, userId, familyId, "System categories cannot be deleted");

        // Budgets are just settings on the category, not history — remove them with it
        // (clearing any expense links to those budgets first, since budgets have no ON DELETE policy).
        expenseRepository.clearBudgetIdByCategory(categoryId);
        budgetRepository.deleteByCategoryId(categoryId);

        // Expenses are historical records and are never touched. If any reference this category,
        // archive it (hidden from pickers, keeps labelling its expenses; revived if recreated).
        // Only a category nothing references is actually removed.
        if (expenseRepository.existsByCategoryId(categoryId)) {
            category.setArchived(true);
            categoryRepository.save(category);
        } else {
            categoryRepository.delete(category);
        }
    }

    private Category findEditableAndValidateOwner(UUID categoryId, UUID userId, UUID familyId, String systemBlockedMessage) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", "id", categoryId));
        if (category.isSystem()) {
            throw new BusinessException(systemBlockedMessage, HttpStatus.FORBIDDEN);
        }
        boolean ownedByFamily = familyId != null && familyId.equals(category.getFamilyId());
        boolean ownedByUser   = userId   != null && userId.equals(category.getUserId());
        if (!ownedByFamily && !ownedByUser) {
            throw new AccessDeniedException("Category does not belong to you");
        }
        return category;
    }
}
