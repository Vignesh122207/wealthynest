package com.wealthynest.domain.account.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
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

class WalletAccountRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private WalletAccountRepository walletAccountRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Peter").email("peter-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private WalletAccount persistAccount(AccountType type, boolean archived, boolean primary,
                                          BigDecimal lowBalanceThreshold) {
        WalletAccount a = WalletAccount.builder().userId(userId).accountType(type).name(type.name())
                .archived(archived).primary(primary).lowBalanceThreshold(lowBalanceThreshold).build();
        entityManager.persist(a);
        return a;
    }

    @Test
    @DisplayName("findByUserIdOrderByCreatedAtAsc returns oldest-first")
    void findByUserOrdersOldestFirst() throws InterruptedException {
        WalletAccount older = persistAccount(AccountType.BANK_ACCOUNT, false, false, null);
        entityManager.flush();
        Thread.sleep(5);
        WalletAccount newer = persistAccount(AccountType.CASH_WALLET, false, false, null);
        entityManager.flush();

        List<WalletAccount> result = walletAccountRepository.findByUserIdOrderByCreatedAtAsc(userId);

        assertThat(result).extracting(WalletAccount::getId).containsExactly(older.getId(), newer.getId());
    }

    @Test
    @DisplayName("findByUserIdAndArchivedTrueOrderByCreatedAtAsc excludes non-archived accounts")
    void findArchivedExcludesActive() {
        persistAccount(AccountType.BANK_ACCOUNT, false, false, null);
        WalletAccount archived = persistAccount(AccountType.CASH_WALLET, true, false, null);
        entityManager.flush();

        List<WalletAccount> result = walletAccountRepository.findByUserIdAndArchivedTrueOrderByCreatedAtAsc(userId);

        assertThat(result).extracting(WalletAccount::getId).containsExactly(archived.getId());
    }

    @Test
    @DisplayName("findByUserIdInAndArchivedFalse batches across multiple users, excluding archived")
    void findByUserIdInExcludesArchived() {
        User user2 = User.builder().fullName("Quinn").email("quinn-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user2);
        entityManager.flush();

        WalletAccount mine = persistAccount(AccountType.BANK_ACCOUNT, false, false, null);
        WalletAccount myArchived = persistAccount(AccountType.CASH_WALLET, true, false, null);
        WalletAccount theirs = WalletAccount.builder().userId(user2.getId()).accountType(AccountType.BANK_ACCOUNT)
                .name("Theirs").build();
        entityManager.persist(theirs);
        entityManager.flush();

        List<WalletAccount> result = walletAccountRepository.findByUserIdInAndArchivedFalse(List.of(userId, user2.getId()));

        assertThat(result).extracting(WalletAccount::getId).containsExactlyInAnyOrder(mine.getId(), theirs.getId());
    }

    @Nested
    @DisplayName("existence checks")
    class ExistenceTests {

        @Test
        @DisplayName("existsByUserIdAndAccountType matches regardless of archived state")
        void existsByUserAndTypeIgnoresArchived() {
            persistAccount(AccountType.CREDIT_CARD, true, false, null);
            entityManager.flush();

            assertThat(walletAccountRepository.existsByUserIdAndAccountType(userId, AccountType.CREDIT_CARD)).isTrue();
        }

        @Test
        @DisplayName("existsByUserIdAndAccountTypeAndArchivedFalse excludes archived accounts")
        void existsByUserAndTypeAndActiveExcludesArchived() {
            persistAccount(AccountType.CREDIT_CARD, true, false, null);
            entityManager.flush();

            assertThat(walletAccountRepository.existsByUserIdAndAccountTypeAndArchivedFalse(userId, AccountType.CREDIT_CARD)).isFalse();
        }
    }

    @Test
    @DisplayName("findByIdAndUserId and findByIdAndUserIdForUpdate both scope to the owning user")
    void findByIdAndUserIdScopesToOwner() {
        WalletAccount a = persistAccount(AccountType.BANK_ACCOUNT, false, false, null);
        entityManager.flush();

        assertThat(walletAccountRepository.findByIdAndUserId(a.getId(), userId)).isPresent();
        assertThat(walletAccountRepository.findByIdAndUserId(a.getId(), UUID.randomUUID())).isEmpty();

        Optional<WalletAccount> locked = walletAccountRepository.findByIdAndUserIdForUpdate(a.getId(), userId);
        assertThat(locked).isPresent();
    }

    @Test
    @DisplayName("findByArchivedFalseAndLowBalanceThresholdIsNotNull only returns active accounts with a configured threshold")
    void findLowBalanceCandidatesFiltersCorrectly() {
        // Unscoped by design (LowBalanceScheduler sweeps every account system-wide), so a
        // full-suite run sharing one Testcontainers Postgres with other tests that create real
        // thresholded accounts means this can't assert an absolute count — assert the delta caused
        // by this test's own inserts instead (see feedback_test_infra_patterns.md).
        long before = walletAccountRepository.findByArchivedFalseAndLowBalanceThresholdIsNotNull().size();

        WalletAccount candidate = persistAccount(AccountType.BANK_ACCOUNT, false, false, new BigDecimal("1000")); // candidate
        persistAccount(AccountType.BANK_ACCOUNT, false, false, null); // no threshold — excluded
        persistAccount(AccountType.BANK_ACCOUNT, true, false, new BigDecimal("500")); // archived — excluded
        entityManager.flush();

        List<WalletAccount> result = walletAccountRepository.findByArchivedFalseAndLowBalanceThresholdIsNotNull();

        assertThat(result).hasSize((int) before + 1);
        assertThat(result).extracting(WalletAccount::getId).contains(candidate.getId());
        assertThat(result.stream().filter(a -> a.getId().equals(candidate.getId())).findFirst().orElseThrow()
                .getLowBalanceThreshold()).isEqualByComparingTo("1000");
    }

    @Test
    @DisplayName("clearPrimaryForType unsets primary only for accounts of the given type")
    void clearPrimaryForTypeScopesToType() {
        WalletAccount primaryBank = persistAccount(AccountType.BANK_ACCOUNT, false, true, null);
        WalletAccount primaryCash = persistAccount(AccountType.CASH_WALLET, false, true, null);
        entityManager.flush();
        entityManager.clear();

        walletAccountRepository.clearPrimaryForType(userId, AccountType.BANK_ACCOUNT);
        entityManager.clear();

        assertThat(entityManager.find(WalletAccount.class, primaryBank.getId()).isPrimary()).isFalse();
        assertThat(entityManager.find(WalletAccount.class, primaryCash.getId()).isPrimary()).isTrue();
    }
}
