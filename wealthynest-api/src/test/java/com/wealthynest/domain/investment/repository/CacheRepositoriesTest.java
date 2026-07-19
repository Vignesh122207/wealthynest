package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.investment.entity.*;
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
 * StockPriceCacheRepository/MFNavCacheRepository/GoldPriceCacheRepository add no custom query
 * methods beyond plain JpaRepository CRUD — these just confirm save/find round-trips correctly
 * against the real Postgres schema (in particular GoldPriceCache's fixed single-row id=1 PK
 * pattern). DismissedDividendRepository's two derived methods get proper coverage below.
 */
class CacheRepositoriesTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private StockPriceCacheRepository stockPriceCacheRepository;
    @Autowired private MFNavCacheRepository mfNavCacheRepository;
    @Autowired private GoldPriceCacheRepository goldPriceCacheRepository;
    @Autowired private DismissedDividendRepository dismissedDividendRepository;

    @Test
    @DisplayName("StockPriceCacheRepository round-trips a row keyed by symbol")
    void stockPriceCacheRoundTrips() {
        stockPriceCacheRepository.save(StockPriceCache.builder().symbol("INFY").currentPrice(new BigDecimal("1500")).build());

        Optional<StockPriceCache> found = stockPriceCacheRepository.findById("INFY");

        assertThat(found).isPresent();
        assertThat(found.get().getCurrentPrice()).isEqualByComparingTo("1500");
    }

    @Test
    @DisplayName("MFNavCacheRepository round-trips a row keyed by scheme code")
    void mfNavCacheRoundTrips() {
        mfNavCacheRepository.save(MFNavCache.builder().schemeCode("SC001").nav(new BigDecimal("45.67")).build());

        Optional<MFNavCache> found = mfNavCacheRepository.findById("SC001");

        assertThat(found).isPresent();
        assertThat(found.get().getNav()).isEqualByComparingTo("45.67");
    }

    @Test
    @DisplayName("GoldPriceCacheRepository upserts the fixed single row (id=1)")
    void goldPriceCacheUpsertsSingleRow() {
        goldPriceCacheRepository.save(GoldPriceCache.builder().id(1).price22kPerGram(new BigDecimal("6000")).build());
        goldPriceCacheRepository.save(GoldPriceCache.builder().id(1).price22kPerGram(new BigDecimal("6100")).build());

        assertThat(goldPriceCacheRepository.count()).isEqualTo(1);
        assertThat(goldPriceCacheRepository.findById(1).orElseThrow().getPrice22kPerGram()).isEqualByComparingTo("6100");
    }

    @Nested
    @DisplayName("DismissedDividendRepository")
    class DismissedDividendTests {

        private UUID userId;
        private UUID investmentId;

        @BeforeEach
        void seedUserAssetAndInvestment() {
            User user = User.builder().fullName("Jules").email("jules-" + UUID.randomUUID() + "@x.com")
                    .passwordHash("hash").build();
            entityManager.persist(user);
            userId = user.getId();

            Asset asset = Asset.builder().userId(userId).name("INFY").assetType(AssetType.STOCK)
                    .currentValue(BigDecimal.ZERO).asOfDate(LocalDate.now()).build();
            entityManager.persist(asset);

            Investment investment = Investment.builder().userId(userId).assetId(asset.getId())
                    .investmentType(InvestmentType.STOCK).symbol("INFY")
                    .investedAmount(new BigDecimal("1000")).currentValue(new BigDecimal("1200")).build();
            entityManager.persist(investment);
            investmentId = investment.getId();

            entityManager.flush();
        }

        @Test
        @DisplayName("existsByUserIdAndInvestmentIdAndExDate detects an already-dismissed suggestion")
        void existsDetectsAlreadyDismissed() {
            DismissedDividend d = DismissedDividend.builder().userId(userId).investmentId(investmentId)
                    .exDate(LocalDate.of(2026, 6, 1)).build();
            entityManager.persist(d);
            entityManager.flush();

            assertThat(dismissedDividendRepository.existsByUserIdAndInvestmentIdAndExDate(
                    userId, investmentId, LocalDate.of(2026, 6, 1))).isTrue();
            assertThat(dismissedDividendRepository.existsByUserIdAndInvestmentIdAndExDate(
                    userId, investmentId, LocalDate.of(2026, 7, 1))).isFalse();
        }

        @Test
        @DisplayName("findByUserId returns every dismissal for that user")
        void findByUserIdReturnsAll() {
            entityManager.persist(DismissedDividend.builder().userId(userId).investmentId(investmentId)
                    .exDate(LocalDate.of(2026, 6, 1)).build());
            entityManager.persist(DismissedDividend.builder().userId(userId).investmentId(investmentId)
                    .exDate(LocalDate.of(2026, 9, 1)).build());
            entityManager.flush();

            List<DismissedDividend> result = dismissedDividendRepository.findByUserId(userId);

            assertThat(result).hasSize(2);
        }
    }
}
