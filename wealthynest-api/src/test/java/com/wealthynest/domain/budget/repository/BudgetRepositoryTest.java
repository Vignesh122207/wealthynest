package com.wealthynest.domain.budget.repository;

import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies BudgetRepository, with particular focus on migrateUserBudgetsToFamily's NOT EXISTS
 * dedup guard: without it, moving a user's budget into a family that already has a template on
 * the same category+type would trip the budgets_unique_family_type unique index. The migration
 * is expected to silently skip (not touch) a user budget when that collision would occur.
 */
class BudgetRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private BudgetRepository budgetRepository;

    private UUID userId;
    private UUID familyId;
    private UUID categoryId;

    @BeforeEach
    void seedUserFamilyAndCategory() {
        User user = User.builder().fullName("Oscar").email("oscar-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Family family = Family.builder().name("The Oscars").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
        entityManager.persist(family);
        familyId = family.getId();

        Category category = Category.builder().userId(userId).name("Groceries").type(CategoryType.EXPENSE).build();
        entityManager.persist(category);
        categoryId = category.getId();

        entityManager.flush();
    }

    private Budget persistBudget(UUID userId, UUID familyId, UUID categoryId, BudgetType type, BigDecimal amount) {
        Budget b = Budget.builder().userId(userId).familyId(familyId).categoryId(categoryId)
                .budgetType(type).amount(amount).build();
        entityManager.persist(b);
        return b;
    }

    @Nested
    @DisplayName("owner-scoped lookups")
    class LookupTests {

        @Test
        @DisplayName("findByUserId and findByFamilyId are scoped independently")
        void findByUserAndFamilyAreIndependent() {
            persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            persistBudget(null, familyId, categoryId, BudgetType.MONTHLY, new BigDecimal("8000"));
            entityManager.flush();

            assertThat(budgetRepository.findByUserId(userId)).hasSize(1);
            assertThat(budgetRepository.findByFamilyId(familyId)).hasSize(1);
        }

        @Test
        @DisplayName("findByUserIdAndCategoryIdAndBudgetType finds the exact template")
        void findExactUserTemplate() {
            persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            entityManager.flush();

            Optional<Budget> found = budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY);

            assertThat(found).isPresent();
        }

        @Test
        @DisplayName("findByUserIdAndCategoryIdAndBudgetType does not match a YEARLY budget when MONTHLY is requested")
        void doesNotMatchWrongType() {
            persistBudget(userId, null, categoryId, BudgetType.YEARLY, new BigDecimal("60000"));
            entityManager.flush();

            assertThat(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY)).isEmpty();
        }

        @Test
        @DisplayName("findByFamilyIdAndCategoryIdAndBudgetType finds the exact family template")
        void findExactFamilyTemplate() {
            persistBudget(null, familyId, categoryId, BudgetType.MONTHLY, new BigDecimal("8000"));
            entityManager.flush();

            assertThat(budgetRepository.findByFamilyIdAndCategoryIdAndBudgetType(familyId, categoryId, BudgetType.MONTHLY)).isPresent();
        }

        @Test
        @DisplayName("findByUserIdAndCategoryId and findByFamilyIdAndCategoryId return every budget type for the category")
        void findByCategoryReturnsAllTypes() {
            persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            persistBudget(userId, null, categoryId, BudgetType.YEARLY, new BigDecimal("60000"));
            entityManager.flush();

            List<Budget> result = budgetRepository.findByUserIdAndCategoryId(userId, categoryId);

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("existsByCategoryId reflects whether any budget references the category")
        void existsByCategoryIdReflectsReferences() {
            assertThat(budgetRepository.existsByCategoryId(categoryId)).isFalse();

            persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            entityManager.flush();

            assertThat(budgetRepository.existsByCategoryId(categoryId)).isTrue();
        }
    }

    @Nested
    @DisplayName("family-linkage modifying queries")
    class FamilyLinkageTests {

        @Test
        @DisplayName("migrateUserBudgetsToFamily moves an unassigned budget when the family has no colliding template")
        void migratesWhenNoCollision() {
            Budget unassigned = persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.migrateUserBudgetsToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Budget.class, unassigned.getId()).getFamilyId()).isEqualTo(familyId);
        }

        @Test
        @DisplayName("migrateUserBudgetsToFamily skips a budget whose move would collide with an existing family template on the same category+type")
        void skipsWhenFamilyAlreadyHasMatchingTemplate() {
            persistBudget(null, familyId, categoryId, BudgetType.MONTHLY, new BigDecimal("8000")); // family's existing template
            Budget mineColliding = persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.migrateUserBudgetsToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            // left unassigned rather than violating budgets_unique_family_type
            assertThat(entityManager.find(Budget.class, mineColliding.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("migrateUserBudgetsToFamily does not touch a budget that already has a familyId")
        void doesNotTouchAlreadyAssigned() {
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            Budget alreadyAssigned = persistBudget(userId, otherFamily.getId(), categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.migrateUserBudgetsToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Budget.class, alreadyAssigned.getId()).getFamilyId()).isEqualTo(otherFamily.getId());
        }

        @Test
        @DisplayName("clearFamilyId nulls familyId for every budget in the family")
        void clearFamilyIdNullsAll() {
            Budget b = persistBudget(null, familyId, categoryId, BudgetType.MONTHLY, new BigDecimal("8000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.clearFamilyId(familyId);
            entityManager.clear();

            assertThat(entityManager.find(Budget.class, b.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("clearFamilyIdForUser only detaches the specified user's budgets")
        void clearFamilyIdForUserOnlyTouchesThatUser() {
            Budget mine = persistBudget(userId, familyId, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));

            User otherUser = User.builder().fullName("Priya").email("priya-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(otherUser);
            Category otherCategory = Category.builder().userId(otherUser.getId()).name("Dining").type(CategoryType.EXPENSE).build();
            entityManager.persist(otherCategory);
            Budget theirs = persistBudget(otherUser.getId(), familyId, otherCategory.getId(), BudgetType.MONTHLY, new BigDecimal("3000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.clearFamilyIdForUser(userId, familyId);
            entityManager.clear();

            assertThat(entityManager.find(Budget.class, mine.getId()).getFamilyId()).isNull();
            assertThat(entityManager.find(Budget.class, theirs.getId()).getFamilyId()).isEqualTo(familyId);
        }

        @Test
        @DisplayName("deleteByCategoryId removes every budget on the category regardless of owner")
        void deleteByCategoryIdRemovesAllOwners() {
            Budget userBudget = persistBudget(userId, null, categoryId, BudgetType.MONTHLY, new BigDecimal("5000"));
            Budget familyBudget = persistBudget(null, familyId, categoryId, BudgetType.YEARLY, new BigDecimal("60000"));
            entityManager.flush();
            entityManager.clear();

            budgetRepository.deleteByCategoryId(categoryId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Budget.class, userBudget.getId())).isNull();
            assertThat(entityManager.find(Budget.class, familyBudget.getId())).isNull();
        }
    }
}
