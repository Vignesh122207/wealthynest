package com.wealthynest.domain.category.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.dto.request.CreateCategoryRequest;
import com.wealthynest.domain.category.dto.request.UpdateCategoryRequest;
import com.wealthynest.domain.category.dto.response.CategoryResponse;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.mapper.CategoryMapper;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceImplTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private CategoryMapper     categoryMapper;
    @Mock private ExpenseRepository  expenseRepository;
    @Mock private BudgetRepository   budgetRepository;

    @InjectMocks
    private CategoryServiceImpl service;

    private final UUID userId     = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(categoryMapper.toEntity(any())).thenAnswer(inv -> Category.builder().type(CategoryType.EXPENSE).build());
        lenient().when(categoryMapper.toResponse(any(Category.class))).thenAnswer(inv -> {
            Category c = inv.getArgument(0);
            return CategoryResponse.builder().id(c.getId()).name(c.getName()).build();
        });
    }

    private Category withId(Category c) {
        ReflectionTestUtils.setField(c, "id", categoryId);
        return c;
    }

    // ─── createCategory ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createCategory")
    class CreateCategoryTests {

        @Test
        @DisplayName("revives a previously-archived category with the same name/type instead of creating a duplicate")
        void revivesArchivedCategoryInsteadOfDuplicating() {
            Category archived = withId(Category.builder().userId(userId).name("Old Name")
                    .type(CategoryType.EXPENSE).archived(true).build());
            when(categoryRepository.findArchivedForRevive("Groceries", CategoryType.EXPENSE, userId, null))
                    .thenReturn(Optional.of(archived));
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateCategoryRequest req = mock(CreateCategoryRequest.class);
            when(req.getName()).thenReturn("Groceries");
            when(req.getType()).thenReturn(CategoryType.EXPENSE);
            when(req.getIcon()).thenReturn("cart");

            service.createCategory(userId, null, req);

            assertThat(archived.isArchived()).isFalse();
            assertThat(archived.getName()).isEqualTo("Groceries");
            assertThat(archived.getIcon()).isEqualTo("cart");
            verify(categoryRepository, never()).save(argThat(c -> c != archived));
        }

        @Test
        @DisplayName("creates a brand-new category when no archived match exists")
        void createsNewCategoryWhenNoArchivedMatch() {
            when(categoryRepository.findArchivedForRevive(any(), any(), any(), any())).thenReturn(Optional.empty());
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateCategoryRequest req = mock(CreateCategoryRequest.class);
            when(req.getName()).thenReturn("New Category");
            when(req.getType()).thenReturn(CategoryType.EXPENSE);

            service.createCategory(userId, null, req);

            var captor = org.mockito.ArgumentCaptor.forClass(Category.class);
            verify(categoryRepository).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        }

        @Test
        @DisplayName("blocks creating a category whose name already exists (system, own, or family) for the same type")
        void blocksDuplicateActiveName() {
            when(categoryRepository.findArchivedForRevive(any(), any(), any(), any())).thenReturn(Optional.empty());
            when(categoryRepository.existsActiveDuplicate("Groceries", CategoryType.EXPENSE, userId, null, null))
                    .thenReturn(true);
            CreateCategoryRequest req = mock(CreateCategoryRequest.class);
            when(req.getName()).thenReturn("Groceries");
            when(req.getType()).thenReturn(CategoryType.EXPENSE);

            assertThatThrownBy(() -> service.createCategory(userId, null, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Groceries");
            verify(categoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("a family-scoped creation sets familyId on the new category")
        void familyScopedCreationSetsFamilyId() {
            UUID familyId = UUID.randomUUID();
            when(categoryRepository.findArchivedForRevive(any(), any(), any(), any())).thenReturn(Optional.empty());
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateCategoryRequest req = mock(CreateCategoryRequest.class);
            when(req.getName()).thenReturn("Shared Category");
            when(req.getType()).thenReturn(CategoryType.EXPENSE);

            service.createCategory(userId, familyId, req);

            var captor = org.mockito.ArgumentCaptor.forClass(Category.class);
            verify(categoryRepository).save(captor.capture());
            assertThat(captor.getValue().getFamilyId()).isEqualTo(familyId);
        }
    }

    // ─── updateCategory / deleteCategory ownership + system-category guard ──────

    @Nested
    @DisplayName("updateCategory / deleteCategory: ownership & system-category rules")
    class OwnershipRulesTests {

        @Test
        @DisplayName("throws when the category does not exist")
        void throwsWhenNotFound() {
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.empty());
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            assertThatThrownBy(() -> service.updateCategory(categoryId, userId, null, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("blocks editing a system category")
        void blocksEditingSystemCategory() {
            Category system = withId(Category.builder().system(true).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(system));
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            assertThatThrownBy(() -> service.updateCategory(categoryId, userId, null, req))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("blocks deleting a system category")
        void blocksDeletingSystemCategory() {
            Category system = withId(Category.builder().system(true).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(system));
            assertThatThrownBy(() -> service.deleteCategory(categoryId, userId, null))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("blocks editing a category owned by neither the caller nor their family")
        void blocksEditingUnownedCategory() {
            Category other = withId(Category.builder().userId(UUID.randomUUID()).familyId(null).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(other));
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            assertThatThrownBy(() -> service.updateCategory(categoryId, userId, null, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("allows editing when owned via family, even if not the personal creator")
        void allowsEditingViaFamilyOwnership() {
            UUID familyId = UUID.randomUUID();
            Category shared = withId(Category.builder().userId(UUID.randomUUID()).familyId(familyId).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(shared));
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            when(req.getName()).thenReturn("Renamed");

            service.updateCategory(categoryId, userId, familyId, req);

            assertThat(shared.getName()).isEqualTo("Renamed");
        }

        @Test
        @DisplayName("blocks renaming into a name that collides with another active category")
        void blocksRenameIntoDuplicateName() {
            Category category = withId(Category.builder().userId(userId).name("Original").type(CategoryType.EXPENSE).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(categoryRepository.existsActiveDuplicate("Shopping", CategoryType.EXPENSE, userId, null, categoryId))
                    .thenReturn(true);
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            when(req.getName()).thenReturn("Shopping");

            assertThatThrownBy(() -> service.updateCategory(categoryId, userId, null, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Shopping");
            verify(categoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("renaming to the same name (case-insensitive) skips the duplicate check")
        void renamingToSameNameSkipsDuplicateCheck() {
            Category category = withId(Category.builder().userId(userId).name("Groceries").type(CategoryType.EXPENSE).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            when(req.getName()).thenReturn("groceries");

            service.updateCategory(categoryId, userId, null, req);

            verify(categoryRepository, never()).existsActiveDuplicate(any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("update only changes fields present in the request (partial update)")
        void partialUpdate() {
            Category category = withId(Category.builder().userId(userId).name("Original").icon("old-icon").build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(categoryRepository.save(any(Category.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateCategoryRequest req = mock(UpdateCategoryRequest.class);
            when(req.getColor()).thenReturn("#ff0000");

            service.updateCategory(categoryId, userId, null, req);

            assertThat(category.getName()).isEqualTo("Original");
            assertThat(category.getIcon()).isEqualTo("old-icon");
            assertThat(category.getColor()).isEqualTo("#ff0000");
        }
    }

    // ─── deleteCategory: archive-vs-hard-delete ─────────────────────────────────

    @Nested
    @DisplayName("deleteCategory: archive vs hard delete")
    class DeleteCategoryTests {

        @Test
        @DisplayName("a category with existing expenses is archived, not deleted (preserves labeling of historical expenses)")
        void categoryWithExpensesIsArchived() {
            Category category = withId(Category.builder().userId(userId).archived(false).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(expenseRepository.existsByCategoryId(categoryId)).thenReturn(true);

            service.deleteCategory(categoryId, userId, null);

            assertThat(category.isArchived()).isTrue();
            verify(categoryRepository, never()).delete(any());
            verify(categoryRepository).save(category);
        }

        @Test
        @DisplayName("a category with no expenses is hard-deleted")
        void categoryWithNoExpensesIsHardDeleted() {
            Category category = withId(Category.builder().userId(userId).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(expenseRepository.existsByCategoryId(categoryId)).thenReturn(false);

            service.deleteCategory(categoryId, userId, null);

            verify(categoryRepository).delete(category);
            verify(categoryRepository, never()).save(any());
        }

        @Test
        @DisplayName("always clears budget links and deletes budgets on the category before checking expense history")
        void alwaysClearsBudgetsRegardlessOfOutcome() {
            Category category = withId(Category.builder().userId(userId).build());
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
            when(expenseRepository.existsByCategoryId(categoryId)).thenReturn(true);

            service.deleteCategory(categoryId, userId, null);

            verify(expenseRepository).clearBudgetIdByCategory(categoryId);
            verify(budgetRepository).deleteByCategoryId(categoryId);
        }
    }
}
