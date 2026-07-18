package com.wealthynest.domain.account.repository;

import com.wealthynest.domain.account.entity.AccountTransfer;
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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies AccountTransferRepository's hand-written @Query methods against a real Postgres,
 * with particular focus on the "regular vs all" transfer distinction — sumTransfersIn/Out counts
 * every row, while sumRegularTransfersIn/Out excludes debt-repayment transfers AND rows whose
 * description is literally "Balance Adjustment". Getting that filter wrong (or applying it
 * inconsistently) would silently corrupt account-balance displays.
 */
class AccountTransferRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private AccountTransferRepository accountTransferRepository;

    private UUID userId;
    private WalletAccount accountA;
    private WalletAccount accountB;

    @BeforeEach
    void seedUserAndAccounts() {
        User user = User.builder().fullName("Dave").email("dave-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        accountA = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT).name("A").build();
        entityManager.persist(accountA);
        accountB = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT).name("B").build();
        entityManager.persist(accountB);
        entityManager.flush();
    }

    private AccountTransfer persistTransfer(WalletAccount from, WalletAccount to, BigDecimal amount,
                                             String description, boolean debt) {
        AccountTransfer t = AccountTransfer.builder().userId(userId)
                .fromAccountId(from == null ? null : from.getId())
                .toAccountId(to == null ? null : to.getId())
                .amount(amount).description(description).debt(debt)
                .transferDate(LocalDate.of(2026, 6, 1)).build();
        entityManager.persist(t);
        return t;
    }

    @Test
    @DisplayName("findByUserIdOrderByTransferDateDesc paginates and orders newest-first")
    void findByUserOrdersDescendingAndPaginates() {
        persistTransfer(accountA, accountB, new BigDecimal("100"), "old", false);
        AccountTransfer newer = AccountTransfer.builder().userId(userId).fromAccountId(accountA.getId())
                .toAccountId(accountB.getId()).amount(new BigDecimal("200")).description("new").debt(false)
                .transferDate(LocalDate.of(2026, 6, 15)).build();
        entityManager.persist(newer);
        entityManager.flush();

        Page<AccountTransfer> page = accountTransferRepository.findByUserIdOrderByTransferDateDesc(
                userId, PageRequest.of(0, 10));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getId()).isEqualTo(newer.getId());
    }

    @Test
    @DisplayName("findByAccountId matches transfers where the account is either the source or the destination")
    void findByAccountIdMatchesEitherSide() {
        WalletAccount accountC = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT).name("C").build();
        entityManager.persist(accountC);

        AccountTransfer outgoing = persistTransfer(accountA, accountB, new BigDecimal("50"), "out of A", false);
        AccountTransfer incoming = persistTransfer(accountC, accountA, new BigDecimal("75"), "into A", false);
        persistTransfer(accountB, accountC, new BigDecimal("999"), "unrelated to A", false);
        entityManager.flush();

        List<AccountTransfer> found = accountTransferRepository.findByAccountId(accountA.getId());

        assertThat(found).extracting(AccountTransfer::getId)
                .containsExactlyInAnyOrder(outgoing.getId(), incoming.getId());
    }

    @Test
    @DisplayName("findTop5ByAccountId caps results at 5 even when more transfers exist")
    void findTop5CapsResults() {
        for (int i = 0; i < 7; i++) {
            persistTransfer(accountA, accountB, new BigDecimal("10"), "t" + i, false);
        }
        entityManager.flush();

        List<AccountTransfer> found = accountTransferRepository.findTop5ByAccountId(accountA.getId());

        assertThat(found).hasSize(5);
    }

    @Nested
    @DisplayName("sumTransfersIn/Out — unfiltered totals")
    class UnfilteredSumTests {

        @Test
        @DisplayName("sumTransfersIn sums every transfer landing in the account, debt or not")
        void sumTransfersInIncludesEverything() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("50"), "debt repayment", true);
            entityManager.flush();

            assertThat(accountTransferRepository.sumTransfersIn(accountB.getId())).isEqualByComparingTo("150");
        }

        @Test
        @DisplayName("sumTransfersOut sums every transfer leaving the account, debt or not")
        void sumTransfersOutIncludesEverything() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("50"), "debt repayment", true);
            entityManager.flush();

            assertThat(accountTransferRepository.sumTransfersOut(accountA.getId())).isEqualByComparingTo("150");
        }
    }

    @Nested
    @DisplayName("sumRegularTransfersIn/Out — excludes debt rows and 'Balance Adjustment' rows")
    class RegularSumTests {

        @Test
        @DisplayName("sumRegularTransfersIn excludes debt-tagged transfers")
        void excludesDebtTagged() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("50"), "debt repayment", true);
            entityManager.flush();

            assertThat(accountTransferRepository.sumRegularTransfersIn(accountB.getId())).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("sumRegularTransfersIn excludes rows whose description is exactly 'Balance Adjustment'")
        void excludesBalanceAdjustment() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("999"), "Balance Adjustment", false);
            entityManager.flush();

            assertThat(accountTransferRepository.sumRegularTransfersIn(accountB.getId())).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("sumRegularTransfersOut excludes debt-tagged and 'Balance Adjustment' rows")
        void excludesDebtAndAdjustmentOnOutSide() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("50"), "debt repayment", true);
            persistTransfer(accountA, accountB, new BigDecimal("999"), "Balance Adjustment", false);
            entityManager.flush();

            assertThat(accountTransferRepository.sumRegularTransfersOut(accountA.getId())).isEqualByComparingTo("100");
        }
    }

    @Nested
    @DisplayName("batched grouped sums — used by list views instead of N per-account queries")
    class GroupedSumTests {

        @Test
        @DisplayName("sumTransfersInGrouped returns one row per account, aggregated across multiple accounts in one query")
        void groupedInSumsPerAccount() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountB, accountA, new BigDecimal("40"), "regular", false);
            entityManager.flush();

            List<Object[]> rows = accountTransferRepository.sumTransfersInGrouped(List.of(accountA.getId(), accountB.getId()));

            Map<UUID, BigDecimal> byAccount = rows.stream()
                    .collect(java.util.stream.Collectors.toMap(r -> (UUID) r[0], r -> (BigDecimal) r[1]));
            assertThat(byAccount.get(accountA.getId())).isEqualByComparingTo("40");
            assertThat(byAccount.get(accountB.getId())).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("sumRegularTransfersOutGrouped applies the same debt/adjustment exclusion as the single-account version")
        void groupedRegularOutExcludesDebtAndAdjustment() {
            persistTransfer(accountA, accountB, new BigDecimal("100"), "regular", false);
            persistTransfer(accountA, accountB, new BigDecimal("999"), "Balance Adjustment", false);
            persistTransfer(accountA, accountB, new BigDecimal("50"), "debt repayment", true);
            entityManager.flush();

            List<Object[]> rows = accountTransferRepository.sumRegularTransfersOutGrouped(List.of(accountA.getId()));

            assertThat(rows).hasSize(1);
            assertThat((BigDecimal) rows.get(0)[1]).isEqualByComparingTo("100");
        }
    }
}
