package com.wealthynest.domain.category.repository;

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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies CategoryRepository's system/family/user visibility rules and the soft-delete revive
 * lookup against a real Postgres — the revive query in particular has a subtle OR/IS NOT NULL
 * guard (userId match OR familyId match when familyId isn't null) that's easy to get backwards.
 */
class CategoryRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private CategoryRepository categoryRepository;

    private UUID userId;
    private UUID familyId;

    @BeforeEach
    void seedUserAndFamily() {
        User user = User.builder().fullName("Frank").email("frank-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Family family = Family.builder().name("The Franks").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
        entityManager.persist(family);
        familyId = family.getId();

        entityManager.flush();
    }

    private Category persistCategory(String name, UUID userId, UUID familyId, boolean system, boolean archived) {
        Category c = Category.builder().userId(userId).familyId(familyId).name(name)
                .type(CategoryType.EXPENSE).system(system).archived(archived).build();
        entityManager.persist(c);
        return c;
    }

    @Nested
    @DisplayName("visibility scoping: own categories plus system categories, excluding archived")
    class VisibilityTests {

        @Test
        @DisplayName("findByFamilyIdOrSystem returns the family's own categories plus system ones, sorted by name")
        void familyOrSystemIncludesBothSortedByName() {
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            persistCategory("Zebra", null, familyId, false, false);
            persistCategory("Apple", null, familyId, false, false);
            persistCategory("Utilities", null, null, true, false); // system
            persistCategory("Other Family's", null, otherFamily.getId(), false, false); // different family — excluded
            entityManager.flush();

            List<Category> result = categoryRepository.findByFamilyIdOrSystem(familyId);

            assertThat(result).extracting(Category::getName).containsExactly("Apple", "Utilities", "Zebra");
        }

        @Test
        @DisplayName("findByFamilyIdOrSystem excludes archived rows even if they'd otherwise match")
        void familyOrSystemExcludesArchived() {
            persistCategory("Old", null, familyId, false, true); // archived — excluded
            entityManager.flush();

            List<Category> result = categoryRepository.findByFamilyIdOrSystem(familyId);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("findByUserIdOrSystem returns the user's own categories plus system ones")
        void userOrSystemIncludesBoth() {
            User otherUser = User.builder().fullName("Helen").email("helen-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(otherUser);

            persistCategory("Groceries", userId, null, false, false);
            persistCategory("Utilities", null, null, true, false); // system
            persistCategory("Someone Else's", otherUser.getId(), null, false, false); // excluded
            entityManager.flush();

            List<Category> result = categoryRepository.findByUserIdOrSystem(userId);

            assertThat(result).extracting(Category::getName).containsExactlyInAnyOrder("Groceries", "Utilities");
        }

        @Test
        @DisplayName("findByUserIdOrSystemIncludingArchived includes archived rows unlike its sibling")
        void includingArchivedVariantKeepsArchivedRows() {
            persistCategory("Old Category", userId, null, false, true);
            entityManager.flush();

            List<Category> result = categoryRepository.findByUserIdOrSystemIncludingArchived(userId);

            assertThat(result).extracting(Category::getName).containsExactly("Old Category");
        }

        @Test
        @DisplayName("findBySystemTrue returns only system categories regardless of owner")
        void findBySystemTrueOnlySystemRows() {
            persistCategory("Groceries", userId, null, false, false);
            persistCategory("Other", null, null, true, false);
            entityManager.flush();

            List<Category> result = categoryRepository.findBySystemTrue();

            assertThat(result).extracting(Category::getName).containsExactly("Other");
        }
    }

    @Nested
    @DisplayName("soft-delete revive lookup")
    class ReviveLookupTests {

        @Test
        @DisplayName("findArchivedForRevive matches an archived, non-system category by owner + name + type")
        void findsArchivedByUserNameAndType() {
            Category archived = persistCategory("Dining", userId, null, false, true);
            entityManager.flush();

            Optional<Category> found = categoryRepository.findArchivedForRevive("dining", CategoryType.EXPENSE, userId, null);

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(archived.getId());
        }

        @Test
        @DisplayName("findArchivedForRevive does not match a non-archived category")
        void doesNotMatchNonArchived() {
            persistCategory("Dining", userId, null, false, false);
            entityManager.flush();

            Optional<Category> found = categoryRepository.findArchivedForRevive("Dining", CategoryType.EXPENSE, userId, null);

            assertThat(found).isEmpty();
        }

        @Test
        @DisplayName("findArchivedForRevive does not match a system category even if archived")
        void doesNotMatchSystemCategory() {
            persistCategory("Dining", null, null, true, true);
            entityManager.flush();

            Optional<Category> found = categoryRepository.findArchivedForRevive("Dining", CategoryType.EXPENSE, userId, null);

            assertThat(found).isEmpty();
        }

        @Test
        @DisplayName("findArchivedForRevive also matches via familyId when the caller passes one")
        void matchesViaFamilyIdWhenProvided() {
            Category archived = persistCategory("Dining", null, familyId, false, true);
            entityManager.flush();

            Optional<Category> found = categoryRepository.findArchivedForRevive("Dining", CategoryType.EXPENSE, UUID.randomUUID(), familyId);

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(archived.getId());
        }
    }

    @Nested
    @DisplayName("family-linkage modifying queries")
    class FamilyLinkageTests {

        @Test
        @DisplayName("migrateUserCategoriesToFamily only touches the user's own, unassigned, non-system categories")
        void migrateOnlyTouchesUnassignedNonSystem() {
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            Category unassigned = persistCategory("Groceries", userId, null, false, false);
            Category alreadyAssigned = persistCategory("Dining", userId, otherFamily.getId(), false, false);
            Category systemCategory = persistCategory("Utilities", userId, null, true, false);
            entityManager.flush();
            entityManager.clear();

            categoryRepository.migrateUserCategoriesToFamily(familyId, userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Category.class, unassigned.getId()).getFamilyId()).isEqualTo(familyId);
            assertThat(entityManager.find(Category.class, alreadyAssigned.getId()).getFamilyId()).isEqualTo(otherFamily.getId());
            assertThat(entityManager.find(Category.class, systemCategory.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("clearFamilyId detaches every non-system category from the family")
        void clearFamilyIdDetachesNonSystem() {
            Category c = persistCategory("Groceries", userId, familyId, false, false);
            entityManager.flush();
            entityManager.clear();

            categoryRepository.clearFamilyId(familyId);
            entityManager.clear();

            assertThat(entityManager.find(Category.class, c.getId()).getFamilyId()).isNull();
        }

        @Test
        @DisplayName("clearFamilyIdForUser only detaches the specified user's categories, leaving other members' intact")
        void clearFamilyIdForUserOnlyTouchesThatUser() {
            Category mine = persistCategory("Groceries", userId, familyId, false, false);

            User otherUser = User.builder().fullName("Grace").email("grace-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(otherUser);
            Category theirs = persistCategory("Dining", otherUser.getId(), familyId, false, false);
            entityManager.flush();
            entityManager.clear();

            categoryRepository.clearFamilyIdForUser(userId, familyId);
            entityManager.clear();

            assertThat(entityManager.find(Category.class, mine.getId()).getFamilyId()).isNull();
            assertThat(entityManager.find(Category.class, theirs.getId()).getFamilyId()).isEqualTo(familyId);
        }
    }
}
