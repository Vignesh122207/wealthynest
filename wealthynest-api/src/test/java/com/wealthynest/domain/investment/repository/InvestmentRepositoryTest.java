package com.wealthynest.domain.investment.repository;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.entity.StockPriceCache;
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
 * Runs every custom @Query (JPQL and native) against a real Postgres — the native bulk-update
 * queries in particular (bulkUpdatePriceBySymbol, syncStockCurrentValuesFromCache,
 * bulkUpdateNavBySchemeCode, bulkUpdateGoldPrice) reference raw column names and a CASE
 * expression that H2 or a mocked repository would never validate.
 */
class InvestmentRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private InvestmentRepository investmentRepository;

    private UUID userId;

    @BeforeEach
    void seedUser() {
        User user = User.builder().fullName("Bob").email("bob-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();
        entityManager.flush();
    }

    private Investment persistInvestment(InvestmentType type, String symbol, BigDecimal units,
                                          BigDecimal investedAmount, BigDecimal currentValue, LifecycleStatus status) {
        Investment i = Investment.builder().userId(userId).investmentType(type)
                .symbol(symbol).units(units).investedAmount(investedAmount).currentValue(currentValue)
                .status(status).build();
        entityManager.persist(i);
        return i;
    }

    // ─── active-scoped sums ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("active-scoped aggregate sums")
    class AggregateSumTests {

        @Test
        @DisplayName("sumCurrentValueByUser only counts active investments for that user")
        void sumCurrentValueOnlyActive() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            persistInvestment(InvestmentType.STOCK, "TCS", new BigDecimal("5"),
                    new BigDecimal("500"), new BigDecimal("600"), LifecycleStatus.ARCHIVED); // excluded

            BigDecimal sum = investmentRepository.sumCurrentValueByUser(userId);

            assertThat(sum).isEqualByComparingTo("1200");
        }

        @Test
        @DisplayName("sumCurrentValueByUser returns zero (not null) when the user has no investments")
        void sumCurrentValueReturnsZeroNotNull() {
            BigDecimal sum = investmentRepository.sumCurrentValueByUser(UUID.randomUUID());

            assertThat(sum).isEqualByComparingTo(BigDecimal.ZERO);
        }

        @Test
        @DisplayName("sumCurrentValueByUserIn aggregates across multiple family members in one query")
        void sumCurrentValueByUserInAggregatesAcrossUsers() {
            User user2 = User.builder().fullName("Carol").email("carol-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(user2);
            entityManager.flush();
            UUID user2Id = user2.getId();

            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            Investment i2 = Investment.builder().userId(user2Id)
                    .investmentType(InvestmentType.STOCK).symbol("TCS").units(new BigDecimal("5"))
                    .investedAmount(new BigDecimal("500")).currentValue(new BigDecimal("800"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(i2);
            entityManager.flush();

            BigDecimal sum = investmentRepository.sumCurrentValueByUserIn(List.of(userId, user2Id));

            assertThat(sum).isEqualByComparingTo("2000");
        }

        @Test
        @DisplayName("sumInvestedAmountByUser sums invested_amount, not current_value, for active rows")
        void sumInvestedAmountUsesInvestedAmountColumn() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1500"), LifecycleStatus.ACTIVE);

            BigDecimal sum = investmentRepository.sumInvestedAmountByUser(userId);

            assertThat(sum).isEqualByComparingTo("1000");
        }
    }

    // ─── typed load queries ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("typed load queries")
    class TypedLoadTests {

        @Test
        @DisplayName("findByInvestmentTypeAndStatus filters by type and excludes non-active rows")
        void findByTypeExcludesInactive() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            persistInvestment(InvestmentType.MUTUAL_FUND, "MF1", new BigDecimal("100"),
                    new BigDecimal("1000"), new BigDecimal("1100"), LifecycleStatus.ACTIVE);
            persistInvestment(InvestmentType.STOCK, "TCS", new BigDecimal("5"),
                    new BigDecimal("500"), new BigDecimal("600"), LifecycleStatus.CLOSED);

            List<Investment> stocks = investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.STOCK, LifecycleStatus.ACTIVE);

            assertThat(stocks).extracting(Investment::getSymbol).containsExactly("INFY");
        }

        @Test
        @DisplayName("findByUserIdAndSymbolAndInvestmentTypeAndStatus finds the exact active holding")
        void findExactActiveHolding() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);

            Optional<Investment> found = investmentRepository
                    .findByUserIdAndSymbolAndInvestmentTypeAndStatus(userId, "INFY", InvestmentType.STOCK, LifecycleStatus.ACTIVE);

            assertThat(found).isPresent();
        }

        @Test
        @DisplayName("findByUserIdAndSymbolAndInvestmentTypeAndStatus does not match a closed holding")
        void doesNotMatchInactiveHolding() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.CLOSED);

            Optional<Investment> found = investmentRepository
                    .findByUserIdAndSymbolAndInvestmentTypeAndStatus(userId, "INFY", InvestmentType.STOCK, LifecycleStatus.ACTIVE);

            assertThat(found).isEmpty();
        }

        @Test
        @DisplayName("findDistinctActiveSchemeCodesForMF returns distinct codes, only for active MUTUAL_FUND rows")
        void distinctActiveSchemeCodes() {
            Investment mf1 = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001")
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1100"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(mf1);

            Investment mf2 = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001") // duplicate code
                    .investedAmount(new BigDecimal("500")).currentValue(new BigDecimal("550"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(mf2);

            Investment mf3 = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC002")
                    .investedAmount(new BigDecimal("200")).currentValue(new BigDecimal("210"))
                    .status(LifecycleStatus.ARCHIVED).build(); // not active
            entityManager.persist(mf3);
            entityManager.flush();

            List<String> codes = investmentRepository.findDistinctActiveSchemeCodesForMF();

            assertThat(codes).containsExactlyInAnyOrder("SC001");
        }
    }

    // ─── native bulk-update queries ──────────────────────────────────────────────

    @Nested
    @DisplayName("native bulk-update queries")
    class BulkUpdateTests {

        @Test
        @DisplayName("bulkUpdatePriceBySymbol updates price and recomputes current_value only for active STOCK rows with units")
        void bulkUpdatePriceBySymbolOnlyTouchesActiveStockWithUnits() {
            Investment activeStock = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            Investment inactiveStock = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.CLOSED);
            Investment mfSameSymbol = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.MUTUAL_FUND).symbol("INFY").units(new BigDecimal("10"))
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1200"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(mfSameSymbol);
            entityManager.flush();
            entityManager.clear();

            int updated = investmentRepository.bulkUpdatePriceBySymbol("INFY", new BigDecimal("150"));
            entityManager.clear();

            assertThat(updated).isEqualTo(1);
            Investment reloaded = entityManager.find(Investment.class, activeStock.getId());
            assertThat(reloaded.getCurrentPrice()).isEqualByComparingTo("150");
            assertThat(reloaded.getCurrentValue()).isEqualByComparingTo("1500"); // 10 units * 150

            assertThat(entityManager.find(Investment.class, inactiveStock.getId()).getCurrentPrice()).isNull();
        }

        @Test
        @DisplayName("syncStockCurrentValuesFromCache joins stock_price_cache and updates every active STOCK holding")
        void syncStockCurrentValuesFromCacheJoinsOnSymbol() {
            // stock_price_cache.symbol is a global (non-test-scoped) primary key that other test
            // classes also seed real rows into; a hardcoded "TCS" here previously collided with
            // leftover data from elsewhere when running the full suite, so use a per-run-unique
            // symbol instead of relying on cross-test cleanup.
            String symbol = "SYM" + UUID.randomUUID().toString().substring(0, 8);
            entityManager.persist(StockPriceCache.builder().symbol(symbol).currentPrice(new BigDecimal("3500")).build());
            Investment stock = persistInvestment(InvestmentType.STOCK, symbol, new BigDecimal("2"),
                    new BigDecimal("6000"), new BigDecimal("6500"), LifecycleStatus.ACTIVE);
            entityManager.flush();
            entityManager.clear();

            int updated = investmentRepository.syncStockCurrentValuesFromCache();
            entityManager.clear();

            assertThat(updated).isEqualTo(1);
            Investment reloaded = entityManager.find(Investment.class, stock.getId());
            assertThat(reloaded.getCurrentPrice()).isEqualByComparingTo("3500");
            assertThat(reloaded.getCurrentValue()).isEqualByComparingTo("7000"); // 2 units * 3500
        }

        @Test
        @DisplayName("bulkUpdateNavBySchemeCode updates nav-derived current_value for all active MF rows sharing the scheme code")
        void bulkUpdateNavBySchemeCode() {
            Investment mf = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001").units(new BigDecimal("100"))
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1050"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(mf);
            entityManager.flush();
            entityManager.clear();

            int updated = investmentRepository.bulkUpdateNavBySchemeCode("SC001", new BigDecimal("12.5"));
            entityManager.clear();

            assertThat(updated).isEqualTo(1);
            Investment reloaded = entityManager.find(Investment.class, mf.getId());
            assertThat(reloaded.getCurrentValue()).isEqualByComparingTo("1250.0"); // 100 * 12.5
        }

        @Test
        @DisplayName("bulkUpdateGoldPrice applies the correct karat-tiered price via the CASE expression")
        void bulkUpdateGoldPriceAppliesCorrectKaratTier() {
            Investment gold24k = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.GOLD).quantityGrams(new BigDecimal("10")).goldKarat(24)
                    .investedAmount(new BigDecimal("50000")).currentValue(new BigDecimal("55000"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(gold24k);

            Investment gold22k = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.GOLD).quantityGrams(new BigDecimal("10")).goldKarat(22)
                    .investedAmount(new BigDecimal("45000")).currentValue(new BigDecimal("50000"))
                    .status(LifecycleStatus.ACTIVE).build();
            entityManager.persist(gold22k);
            entityManager.flush();
            entityManager.clear();

            int updated = investmentRepository.bulkUpdateGoldPrice(
                    new BigDecimal("6000"), new BigDecimal("5000"), new BigDecimal("6500")); // p22, p18, p24
            entityManager.clear();

            assertThat(updated).isEqualTo(2);
            assertThat(entityManager.find(Investment.class, gold24k.getId()).getCurrentValue())
                    .isEqualByComparingTo("65000.0000"); // 10g * 6500 (24k tier)
            assertThat(entityManager.find(Investment.class, gold22k.getId()).getCurrentValue())
                    .isEqualByComparingTo("60000.0000"); // 10g * 6000 (22k tier, the CASE else-branch)
        }
    }

    // ─── funding-link existence checks (used by the account-delete history guard) ─

    @Nested
    @DisplayName("funding-link existence checks")
    class FundingLinkExistsTests {

        @Test
        @DisplayName("existsByDebitAccountId detects an investment funded from this account")
        void existsByDebitAccountIdDetectsLink() {
            WalletAccount account = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                    .name("HDFC Savings").build();
            entityManager.persist(account);
            Investment i = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            i.setDebitAccountId(account.getId());
            entityManager.persist(i);
            entityManager.flush();

            assertThat(investmentRepository.existsByDebitAccountId(account.getId())).isTrue();
            assertThat(investmentRepository.existsByDebitAccountId(UUID.randomUUID())).isFalse();
        }

        @Test
        @DisplayName("existsByLinkedAccountId detects an investment crediting income to this account")
        void existsByLinkedAccountIdDetectsLink() {
            WalletAccount account = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                    .name("HDFC Savings").build();
            entityManager.persist(account);
            Investment i = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), LifecycleStatus.ACTIVE);
            i.setLinkedAccountId(account.getId());
            entityManager.persist(i);
            entityManager.flush();

            assertThat(investmentRepository.existsByLinkedAccountId(account.getId())).isTrue();
            assertThat(investmentRepository.existsByLinkedAccountId(UUID.randomUUID())).isFalse();
        }
    }
}
