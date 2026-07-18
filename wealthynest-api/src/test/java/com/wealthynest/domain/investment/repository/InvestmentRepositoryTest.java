package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
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
import java.time.LocalDate;
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

    private Asset persistAsset(AssetType type) {
        Asset asset = Asset.builder().userId(userId).name(type.name()).assetType(type)
                .currentValue(BigDecimal.ZERO).asOfDate(LocalDate.now()).build();
        entityManager.persist(asset);
        return asset;
    }

    private Investment persistInvestment(InvestmentType type, String symbol, BigDecimal units,
                                          BigDecimal investedAmount, BigDecimal currentValue, boolean active) {
        Asset asset = persistAsset(AssetType.STOCK);
        Investment i = Investment.builder().userId(userId).assetId(asset.getId()).investmentType(type)
                .symbol(symbol).units(units).investedAmount(investedAmount).currentValue(currentValue)
                .active(active).build();
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
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            persistInvestment(InvestmentType.STOCK, "TCS", new BigDecimal("5"),
                    new BigDecimal("500"), new BigDecimal("600"), false); // inactive — excluded
            entityManager.flush();

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
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            Asset asset2 = persistAsset(AssetType.STOCK);
            Investment i2 = Investment.builder().userId(user2Id).assetId(asset2.getId())
                    .investmentType(InvestmentType.STOCK).symbol("TCS").units(new BigDecimal("5"))
                    .investedAmount(new BigDecimal("500")).currentValue(new BigDecimal("800")).active(true).build();
            entityManager.persist(i2);
            entityManager.flush();

            BigDecimal sum = investmentRepository.sumCurrentValueByUserIn(List.of(userId, user2Id));

            assertThat(sum).isEqualByComparingTo("2000");
        }

        @Test
        @DisplayName("sumInvestedAmountByUser sums invested_amount, not current_value, for active rows")
        void sumInvestedAmountUsesInvestedAmountColumn() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1500"), true);

            BigDecimal sum = investmentRepository.sumInvestedAmountByUser(userId);

            assertThat(sum).isEqualByComparingTo("1000");
        }
    }

    // ─── typed load queries ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("typed load queries")
    class TypedLoadTests {

        @Test
        @DisplayName("findByInvestmentTypeAndActiveTrue filters by type and excludes inactive rows")
        void findByTypeExcludesInactive() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            persistInvestment(InvestmentType.MUTUAL_FUND, "MF1", new BigDecimal("100"),
                    new BigDecimal("1000"), new BigDecimal("1100"), true);
            persistInvestment(InvestmentType.STOCK, "TCS", new BigDecimal("5"),
                    new BigDecimal("500"), new BigDecimal("600"), false);

            List<Investment> stocks = investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK);

            assertThat(stocks).extracting(Investment::getSymbol).containsExactly("INFY");
        }

        @Test
        @DisplayName("findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue finds the exact active holding")
        void findExactActiveHolding() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), true);

            Optional<Investment> found = investmentRepository
                    .findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "INFY", InvestmentType.STOCK);

            assertThat(found).isPresent();
        }

        @Test
        @DisplayName("findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue does not match an inactive holding")
        void doesNotMatchInactiveHolding() {
            persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), false);

            Optional<Investment> found = investmentRepository
                    .findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "INFY", InvestmentType.STOCK);

            assertThat(found).isEmpty();
        }

        @Test
        @DisplayName("findDistinctActiveSchemeCodesForMF returns distinct codes, only for active MUTUAL_FUND rows")
        void distinctActiveSchemeCodes() {
            Asset a1 = persistAsset(AssetType.MUTUAL_FUND);
            Investment mf1 = Investment.builder().userId(userId).assetId(a1.getId())
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001")
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1100")).active(true).build();
            entityManager.persist(mf1);

            Asset a2 = persistAsset(AssetType.MUTUAL_FUND);
            Investment mf2 = Investment.builder().userId(userId).assetId(a2.getId())
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001") // duplicate code
                    .investedAmount(new BigDecimal("500")).currentValue(new BigDecimal("550")).active(true).build();
            entityManager.persist(mf2);

            Asset a3 = persistAsset(AssetType.MUTUAL_FUND);
            Investment mf3 = Investment.builder().userId(userId).assetId(a3.getId())
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC002")
                    .investedAmount(new BigDecimal("200")).currentValue(new BigDecimal("210")).active(false).build(); // inactive
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
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            Investment inactiveStock = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), false);
            Asset mfAsset = persistAsset(AssetType.MUTUAL_FUND);
            Investment mfSameSymbol = Investment.builder().userId(userId).assetId(mfAsset.getId())
                    .investmentType(InvestmentType.MUTUAL_FUND).symbol("INFY").units(new BigDecimal("10"))
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1200")).active(true).build();
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
                    new BigDecimal("6000"), new BigDecimal("6500"), true);
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
            Asset asset = persistAsset(AssetType.MUTUAL_FUND);
            Investment mf = Investment.builder().userId(userId).assetId(asset.getId())
                    .investmentType(InvestmentType.MUTUAL_FUND).schemeCode("SC001").units(new BigDecimal("100"))
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1050")).active(true).build();
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
            Asset asset24 = persistAsset(AssetType.GOLD);
            Investment gold24k = Investment.builder().userId(userId).assetId(asset24.getId())
                    .investmentType(InvestmentType.GOLD).quantityGrams(new BigDecimal("10")).goldKarat(24)
                    .investedAmount(new BigDecimal("50000")).currentValue(new BigDecimal("55000")).active(true).build();
            entityManager.persist(gold24k);

            Asset asset22 = persistAsset(AssetType.GOLD);
            Investment gold22k = Investment.builder().userId(userId).assetId(asset22.getId())
                    .investmentType(InvestmentType.GOLD).quantityGrams(new BigDecimal("10")).goldKarat(22)
                    .investedAmount(new BigDecimal("45000")).currentValue(new BigDecimal("50000")).active(true).build();
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

    // ─── link-clearing modifying queries ─────────────────────────────────────────

    @Nested
    @DisplayName("account-link clearing on account deletion")
    class ClearLinkTests {

        @Test
        @DisplayName("clearLinkedAccountId nulls linked_account_id for every investment referencing it")
        void clearLinkedAccountIdNullsReference() {
            WalletAccount account = WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                    .name("HDFC Savings").build();
            entityManager.persist(account);
            Investment i = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            i.setLinkedAccountId(account.getId());
            entityManager.persist(i);
            entityManager.flush();
            entityManager.clear();

            investmentRepository.clearLinkedAccountId(account.getId());
            entityManager.clear();

            assertThat(entityManager.find(Investment.class, i.getId()).getLinkedAccountId()).isNull();
        }

        @Test
        @DisplayName("clearDebitAccountId nulls both debit_account_id and debit_transfer_id together")
        void clearDebitAccountIdNullsBothFields() {
            UUID accountId = UUID.randomUUID();
            Investment i = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                    new BigDecimal("1000"), new BigDecimal("1200"), true);
            i.setDebitAccountId(accountId);
            i.setDebitTransferId(UUID.randomUUID());
            entityManager.persist(i);
            entityManager.flush();
            entityManager.clear();

            investmentRepository.clearDebitAccountId(accountId);
            entityManager.clear();

            Investment reloaded = entityManager.find(Investment.class, i.getId());
            assertThat(reloaded.getDebitAccountId()).isNull();
            assertThat(reloaded.getDebitTransferId()).isNull();
        }
    }

    // ─── derived query / existence checks ────────────────────────────────────────

    @Test
    @DisplayName("existsByAssetIdAndActiveTrueAndIdNot detects another active investment already linked to the asset")
    void existsByAssetExcludesSelf() {
        Investment i = persistInvestment(InvestmentType.STOCK, "INFY", new BigDecimal("10"),
                new BigDecimal("1000"), new BigDecimal("1200"), true);
        entityManager.flush();

        assertThat(investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(i.getAssetId(), i.getId())).isFalse();
        assertThat(investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(i.getAssetId(), UUID.randomUUID())).isTrue();
    }
}
