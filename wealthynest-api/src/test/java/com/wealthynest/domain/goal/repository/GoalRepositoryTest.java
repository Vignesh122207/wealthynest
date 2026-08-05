package com.wealthynest.domain.goal.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.goal.entity.Goal;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class GoalRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private GoalRepository goalRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Rita").email("rita-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private Goal persistGoal(UUID accountId) {
        Goal g = Goal.builder().userId(userId).name("Emergency Fund")
                .targetAmount(new BigDecimal("100000")).savedAmount(BigDecimal.ZERO).accountId(accountId).build();
        entityManager.persist(g);
        return g;
    }

    @Test
    @DisplayName("findByUserIdOrderByCreatedAtAsc returns only the given user's goals, oldest-first")
    void findByUserOrdersOldestFirst() throws InterruptedException {
        Goal older = persistGoal(null);
        entityManager.flush();
        Thread.sleep(5);
        Goal newer = persistGoal(null);
        entityManager.flush();

        User otherUser = User.builder().fullName("Sam").email("sam-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(otherUser);
        Goal theirs = Goal.builder().userId(otherUser.getId()).name("Their Goal")
                .targetAmount(new BigDecimal("5000")).savedAmount(BigDecimal.ZERO).build();
        entityManager.persist(theirs);
        entityManager.flush();

        List<Goal> result = goalRepository.findByUserIdOrderByCreatedAtAsc(userId);

        assertThat(result).extracting(Goal::getId).containsExactly(older.getId(), newer.getId());
    }

    @Test
    @DisplayName("existsByAccountId detects a goal linked to this account (used by the account-delete history guard)")
    void existsByAccountIdDetectsLink() {
        WalletAccount account = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                .name("Savings").build();
        entityManager.persist(account);
        persistGoal(account.getId());
        entityManager.flush();

        assertThat(goalRepository.existsByAccountId(account.getId())).isTrue();
        assertThat(goalRepository.existsByAccountId(UUID.randomUUID())).isFalse();
    }
}
