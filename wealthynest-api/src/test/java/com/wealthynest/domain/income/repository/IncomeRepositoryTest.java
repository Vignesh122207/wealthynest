package com.wealthynest.domain.income.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies IncomeRepository's debt-exclusion filter (present on the "regular" family of queries,
 * absent on the plain sumByAccountId/findAllByAccountId siblings) and the period-based lookups
 * against a real Postgres, plus the account-unlink and hard-delete cascade paths used when a
 * wallet account is closed.
 */
class IncomeRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private IncomeRepository incomeRepository;

    private UUID userId;
    private WalletAccount account;

    @BeforeEach
    void seedUserAndAccount() {
        User user = User.builder().fullName("Eve").email("eve-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        account = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT).name("Salary A/C").build();
        entityManager.persist(account);
        entityManager.flush();
    }

    private IncomeEntry persistIncome(BigDecimal amount, LocalDate date, boolean debt, WalletAccount acc) {
        IncomeEntry e = IncomeEntry.builder().userId(userId).accountId(acc == null ? null : acc.getId())
                .source(IncomeSource.SALARY).amount(amount).incomeDate(date)
                .periodMonth(date.getMonthValue()).periodYear(date.getYear()).debt(debt).build();
        entityManager.persist(e);
        return e;
    }

    @Nested
    @DisplayName("period-scoped listing/summing excludes debt entries")
    class PeriodDebtFilterTests {

        @Test
        @DisplayName("findByUserIdAndDebtFalseOrderByIncomeDateDesc excludes debt-tagged rows and orders newest-first")
        void debtFalseListExcludesDebtAndOrdersDesc() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            IncomeEntry newer = persistIncome(new BigDecimal("200"), LocalDate.of(2026, 6, 15), false, account);
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 6, 20), true, account); // debt — excluded
            entityManager.flush();

            List<IncomeEntry> rows = incomeRepository.findByUserIdAndDebtFalseOrderByIncomeDateDesc(userId);

            assertThat(rows).hasSize(2);
            assertThat(rows.get(0).getId()).isEqualTo(newer.getId());
        }

        @Test
        @DisplayName("findByUserIdOrderByIncomeDateDesc (no debt filter) includes debt-tagged rows")
        void unfilteredListIncludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 6, 20), true, account);
            entityManager.flush();

            List<IncomeEntry> rows = incomeRepository.findByUserIdOrderByIncomeDateDesc(userId);

            assertThat(rows).hasSize(2);
        }

        @Test
        @DisplayName("sumByUserAndPeriod excludes debt rows for the given month/year")
        void sumByPeriodExcludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false, account);
            persistIncome(new BigDecimal("500"), LocalDate.of(2026, 6, 6), true, account);
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 7, 1), false, account); // wrong month
            entityManager.flush();

            BigDecimal sum = incomeRepository.sumByUserAndPeriod(userId, 2026, 6);

            assertThat(sum).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("sumByUserAndYearGroupedByMonth groups by period_month within the year, excluding debt")
        void groupedByMonthExcludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 3, 5), false, account);
            persistIncome(new BigDecimal("200"), LocalDate.of(2026, 3, 20), false, account);
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 3, 25), true, account); // debt — excluded
            entityManager.flush();

            List<Object[]> rows = incomeRepository.sumByUserAndYearGroupedByMonth(userId, 2026);

            var march = rows.stream().filter(r -> ((Number) r[0]).intValue() == 3).findFirst().orElseThrow();
            assertThat((BigDecimal) march[1]).isEqualByComparingTo("300");
        }

        @Test
        @DisplayName("findByUserAndYear filters by periodYear and excludes debt rows")
        void findByUserAndYearExcludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 1, 5), false, account);
            persistIncome(new BigDecimal("999"), LocalDate.of(2025, 12, 31), false, account); // wrong year
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 2, 1), true, account); // debt
            entityManager.flush();

            List<IncomeEntry> rows = incomeRepository.findByUserAndYear(userId, 2026);

            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).getAmount()).isEqualByComparingTo("100");
        }
    }

    @Nested
    @DisplayName("account-scoped sums: plain vs 'regular' (debt-excluding) variants")
    class AccountSumTests {

        @Test
        @DisplayName("sumByAccountId includes debt-tagged income")
        void sumByAccountIncludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            persistIncome(new BigDecimal("50"), LocalDate.of(2026, 6, 2), true, account);
            entityManager.flush();

            assertThat(incomeRepository.sumByAccountId(account.getId())).isEqualByComparingTo("150");
        }

        @Test
        @DisplayName("sumRegularByAccountId excludes debt-tagged income")
        void sumRegularByAccountExcludesDebt() {
            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            persistIncome(new BigDecimal("50"), LocalDate.of(2026, 6, 2), true, account);
            entityManager.flush();

            assertThat(incomeRepository.sumRegularByAccountId(account.getId())).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("sumByAccountIdsGrouped and sumRegularByAccountIdsGrouped diverge exactly by the debt filter")
        void groupedVariantsDivergeByDebtFilter() {
            WalletAccount account2 = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT).name("B").build();
            entityManager.persist(account2);

            persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            persistIncome(new BigDecimal("50"), LocalDate.of(2026, 6, 2), true, account);
            persistIncome(new BigDecimal("30"), LocalDate.of(2026, 6, 3), false, account2);
            entityManager.flush();

            List<Object[]> all = incomeRepository.sumByAccountIdsGrouped(List.of(account.getId(), account2.getId()));
            List<Object[]> regular = incomeRepository.sumRegularByAccountIdsGrouped(List.of(account.getId(), account2.getId()));

            Map<UUID, BigDecimal> allByAccount = all.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> (BigDecimal) r[1]));
            Map<UUID, BigDecimal> regularByAccount = regular.stream().collect(Collectors.toMap(r -> (UUID) r[0], r -> (BigDecimal) r[1]));

            assertThat(allByAccount.get(account.getId())).isEqualByComparingTo("150");
            assertThat(regularByAccount.get(account.getId())).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("findTop5ByAccountIdAndDebtFalseOrderByIncomeDateDesc caps at 5 and excludes debt rows")
        void top5ExcludesDebtAndCaps() {
            for (int i = 0; i < 6; i++) {
                persistIncome(new BigDecimal("10"), LocalDate.of(2026, 6, 1 + i), false, account);
            }
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 6, 10), true, account); // debt — excluded
            entityManager.flush();

            List<IncomeEntry> rows = incomeRepository.findTop5ByAccountIdAndDebtFalseOrderByIncomeDateDesc(account.getId());

            assertThat(rows).hasSize(5);
            assertThat(rows).noneMatch(IncomeEntry::isDebt);
        }

        @Test
        @DisplayName("findAllByAccountIdOrderByIncomeDateDesc (no debt filter, no cap) returns every row for the account")
        void findAllByAccountIncludesDebtAndUncapped() {
            for (int i = 0; i < 6; i++) {
                persistIncome(new BigDecimal("10"), LocalDate.of(2026, 6, 1 + i), false, account);
            }
            persistIncome(new BigDecimal("999"), LocalDate.of(2026, 6, 10), true, account);
            entityManager.flush();

            List<IncomeEntry> rows = incomeRepository.findAllByAccountIdOrderByIncomeDateDesc(account.getId());

            assertThat(rows).hasSize(7);
        }
    }

    @Nested
    @DisplayName("account unlink vs hard-delete on account closure")
    class AccountUnlinkTests {

        @Test
        @DisplayName("clearAccountId nulls the account reference without deleting the income row")
        void clearAccountIdNullsReferenceKeepsRow() {
            IncomeEntry e = persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            entityManager.flush();
            entityManager.clear();

            incomeRepository.clearAccountId(account.getId());
            entityManager.clear();

            IncomeEntry reloaded = entityManager.find(IncomeEntry.class, e.getId());
            assertThat(reloaded).isNotNull();
            assertThat(reloaded.getAccountId()).isNull();
        }

        @Test
        @DisplayName("deleteByAccountId removes the income rows outright")
        void deleteByAccountIdRemovesRows() {
            IncomeEntry e = persistIncome(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false, account);
            entityManager.flush();
            entityManager.clear();

            incomeRepository.deleteByAccountId(account.getId());
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(IncomeEntry.class, e.getId())).isNull();
        }
    }
}
