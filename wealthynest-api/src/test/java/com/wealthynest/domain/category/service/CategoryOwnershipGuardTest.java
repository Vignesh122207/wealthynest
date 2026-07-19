package com.wealthynest.domain.category.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryOwnershipGuardTest {

    @Mock private CategoryRepository categoryRepository;

    private CategoryOwnershipGuard guard;

    @BeforeEach
    void setUp() {
        guard = new CategoryOwnershipGuard(categoryRepository);
    }

    private final UUID categoryId = UUID.randomUUID();
    private final UUID userId     = UUID.randomUUID();
    private final UUID familyId   = UUID.randomUUID();

    private Category.CategoryBuilder base() {
        return Category.builder().type(CategoryType.EXPENSE).name("Groceries");
    }

    @Test
    void throwsResourceNotFoundWhenCategoryMissing() {
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void throwsResourceNotFoundWhenCategoryIsArchived() {
        Category archived = base().archived(true).userId(userId).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(archived));

        assertThatThrownBy(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void allowsSystemCategoryRegardlessOfOwner() {
        Category system = base().system(true).userId(UUID.randomUUID()).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(system));

        assertThatCode(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .doesNotThrowAnyException();
    }

    @Test
    void allowsCategoryOwnedByCallerUser() {
        Category owned = base().userId(userId).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(owned));

        assertThatCode(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .doesNotThrowAnyException();
    }

    @Test
    void allowsCategoryOwnedByCallerFamily() {
        Category familyOwned = base().familyId(familyId).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(familyOwned));

        assertThatCode(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .doesNotThrowAnyException();
    }

    @Test
    void deniesCategoryOwnedBySomeoneElse() {
        Category othersCategory = base().userId(UUID.randomUUID()).familyId(UUID.randomUUID()).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(othersCategory));

        assertThatThrownBy(() -> guard.validateCategoryOwnership(categoryId, userId, familyId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void deniesWhenCallerHasNoUserOrFamilyScope() {
        Category othersCategory = base().userId(UUID.randomUUID()).build();
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(othersCategory));

        assertThatThrownBy(() -> guard.validateCategoryOwnership(categoryId, null, null))
                .isInstanceOf(AccessDeniedException.class);
    }
}
