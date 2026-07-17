package com.wealthynest.domain.category.repository;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {

    @Query("SELECT c FROM Category c WHERE (c.familyId = :familyId OR c.system = true) AND c.archived = false ORDER BY c.name")
    List<Category> findByFamilyIdOrSystem(UUID familyId);

    @Query("SELECT c FROM Category c WHERE (c.userId = :userId OR c.system = true) AND c.archived = false ORDER BY c.name")
    List<Category> findByUserIdOrSystem(UUID userId);

    /** Same scope as findByUserIdOrSystem but includes archived categories — for lookups (like the
     * dashboard's category-id -> name map) that must still resolve a name for expenses that point
     * at a since-archived category, instead of falling back to "Other". */
    @Query("SELECT c FROM Category c WHERE (c.userId = :userId OR c.system = true)")
    List<Category> findByUserIdOrSystemIncludingArchived(UUID userId);

    List<Category> findBySystemTrue();

    /**
     * Finds a soft-deleted category the caller owns with the same name and type, so createCategory
     * can revive it instead of inserting a duplicate — reconnecting its historical expenses.
     */
    @Query("""
        SELECT c FROM Category c
        WHERE c.archived = true AND c.system = false
          AND LOWER(c.name) = LOWER(:name) AND c.type = :type
          AND (c.userId = :userId OR (:familyId IS NOT NULL AND c.familyId = :familyId))
        """)
    Optional<Category> findArchivedForRevive(@Param("name") String name, @Param("type") CategoryType type,
                                             @Param("userId") UUID userId, @Param("familyId") UUID familyId);

    @Modifying
    @Query("UPDATE Category c SET c.familyId = :familyId WHERE c.userId = :userId AND c.familyId IS NULL AND c.system = false")
    void migrateUserCategoriesToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Category c SET c.familyId = null WHERE c.familyId = :familyId AND c.system = false")
    void clearFamilyId(@Param("familyId") UUID familyId);

    /** Detaches one departing member's own categories from the family (reverts them to personal). */
    @Modifying
    @Query("UPDATE Category c SET c.familyId = null WHERE c.userId = :userId AND c.familyId = :familyId AND c.system = false")
    void clearFamilyIdForUser(@Param("userId") UUID userId, @Param("familyId") UUID familyId);
}
