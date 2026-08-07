package com.wealthynest.domain.expense.service;

import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.expense.entity.Expense;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.hibernate.query.criteria.HibernateCriteriaBuilder;
import org.hibernate.query.criteria.JpaExpression;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Builds the filter {@link Specification} behind {@link ExpenseServiceImpl#getExpenses}. Pulled out
 * of the service so the predicate logic — in particular the search clause's SQL translation — can
 * be exercised against a real Postgres in ExpenseRepositoryTest, not just verified through a mocked
 * repository that never actually evaluates the Criteria predicates it's handed.
 */
public final class ExpenseSpecifications {

    private ExpenseSpecifications() {}

    public static Specification<Expense> filter(UUID userId, UUID categoryId, LocalDate startDate, LocalDate endDate,
                                                  String search, List<UUID> accountIds,
                                                  BigDecimal minAmount, BigDecimal maxAmount,
                                                  Boolean recurring, Boolean includeDebt) {
        String searchLike = (search != null && !search.isBlank()) ? "%" + search.toLowerCase() + "%" : null;

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Always scope to the current user — combined family view is in /families/{id}/expenses
            predicates.add(cb.equal(root.get("userId"), userId));
            if (categoryId != null) predicates.add(cb.equal(root.get("categoryId"), categoryId));
            if (startDate  != null) predicates.add(cb.greaterThanOrEqualTo(root.get("expenseDate"), startDate));
            if (endDate    != null) predicates.add(cb.lessThanOrEqualTo(root.get("expenseDate"), endDate));
            if (searchLike != null) predicates.add(searchPredicate(root, query, cb, searchLike));
            if (accountIds != null && !accountIds.isEmpty()) predicates.add(root.get("accountId").in(accountIds));
            if (minAmount  != null) predicates.add(cb.greaterThanOrEqualTo(root.get("amount"), minAmount));
            if (maxAmount  != null) predicates.add(cb.lessThanOrEqualTo(root.get("amount"), maxAmount));
            if (recurring  != null) predicates.add(cb.equal(root.get("recurring"), recurring));
            if (!Boolean.TRUE.equals(includeDebt)) predicates.add(cb.equal(root.get("debt"), false));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // Matches the description, the amount (as text), or the name of the expense's own category —
    // the Transactions page's "All" tab already matches all three via its own client-side filter
    // (page.tsx's filteredMergedRows), so a server-scoped search restricted to description only
    // silently disagreed with it for the exact same search box, depending on which tab was open.
    private static Predicate searchPredicate(Root<Expense> root, CriteriaQuery<?> query, CriteriaBuilder cb, String searchLike) {
        Subquery<UUID> categoryMatch = query.subquery(UUID.class);
        Root<Category> categoryRoot = categoryMatch.from(Category.class);
        categoryMatch.select(categoryRoot.get("id"))
                .where(cb.like(cb.lower(categoryRoot.get("name")), searchLike));

        // Expression#as() is a Java-side type witness only — per its own javadoc it "does not
        // cause type conversion" — so it silently produced `amount like ?` with no SQL CAST at
        // all, which Postgres rejects (numeric ~~ text has no operator). Spring's injected
        // CriteriaBuilder is a HibernateCriteriaBuilder at runtime; its cast() emits a real CAST.
        Expression<String> amountAsText =
                ((HibernateCriteriaBuilder) cb).cast((JpaExpression<Number>) (Object) root.get("amount"), String.class);

        return cb.or(
                cb.like(cb.lower(root.get("description")), searchLike),
                cb.like(amountAsText, searchLike),
                root.get("categoryId").in(categoryMatch)
        );
    }
}
