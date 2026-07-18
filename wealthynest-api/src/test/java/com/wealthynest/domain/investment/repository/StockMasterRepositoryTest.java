package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.StockMaster;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * stock_master is also populated by the real StockDataScheduler bhavcopy job whenever a
 * @SpringBootTest boots the full app context elsewhere in the suite (AuthFlowIntegrationTest,
 * in particular) — so every symbol here uses a per-test-unique suffix rather than a real ticker
 * like "INFY"/"TCS", both to dodge the uq_stock_master(symbol, exchange) collision and because
 * countByExchange has no way to scope out that real seeded data (handled via a before/after delta).
 */
class StockMasterRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private StockMasterRepository stockMasterRepository;

    private StockMaster persistStock(String symbol, String companyName, String exchange, String isin, boolean active) {
        StockMaster s = StockMaster.builder().symbol(symbol).companyName(companyName)
                .exchange(exchange).isin(isin).active(active).build();
        entityManager.persist(s);
        return s;
    }

    private static String uniqueSymbol(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    @Nested
    @DisplayName("search — NSE/BSE dedup and ranking")
    class SearchTests {

        @Test
        @DisplayName("BSE result is hidden when the same symbol is already active on NSE")
        void bseHiddenWhenNseHasSameSymbol() {
            String symbol = uniqueSymbol("ZZINFY");
            String isin = "INZZ" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            persistStock(symbol, "Zzinfy Ltd", "NSE", isin, true);
            persistStock(symbol, "Zzinfy Ltd", "BSE", isin, true);
            entityManager.flush();

            List<StockMaster> results = stockMasterRepository.search(symbol.toLowerCase(), Pageable.ofSize(10));

            assertThat(results).hasSize(1);
            assertThat(results.get(0).getExchange()).isEqualTo("NSE");
        }

        @Test
        @DisplayName("BSE result is hidden when the same ISIN is already active on NSE, even with a different symbol")
        void bseHiddenWhenNseHasSameIsin() {
            String companyName = "Zzcorp " + UUID.randomUUID().toString().substring(0, 8);
            String isin = "INZZ" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            persistStock(uniqueSymbol("ZZCORP"), companyName, "NSE", isin, true);
            persistStock(uniqueSymbol("ZZCORPB"), companyName + " (BSE code)", "BSE", isin, true);
            entityManager.flush();

            List<StockMaster> results = stockMasterRepository.search(companyName, Pageable.ofSize(10));

            assertThat(results).extracting(StockMaster::getExchange).containsOnly("NSE");
        }

        @Test
        @DisplayName("a BSE-only stock (no NSE dual-listing) is still returned")
        void bseOnlyStockIsReturned() {
            String symbol = uniqueSymbol("ZZBSEONLY");
            persistStock(symbol, "Some BSE Company", "BSE", null, true);
            entityManager.flush();

            List<StockMaster> results = stockMasterRepository.search(symbol.toLowerCase(), Pageable.ofSize(10));

            assertThat(results).hasSize(1);
        }

        @Test
        @DisplayName("an inactive stock never appears in search results")
        void inactiveStockExcluded() {
            String symbol = uniqueSymbol("ZZDEAD");
            persistStock(symbol, "Delisted Co", "NSE", null, false);
            entityManager.flush();

            assertThat(stockMasterRepository.search(symbol.toLowerCase(), Pageable.ofSize(10))).isEmpty();
        }

        @Test
        @DisplayName("an exact symbol match ranks ahead of a company-name-only match")
        void exactSymbolMatchRanksFirst() {
            String exactSymbolTicker = uniqueSymbol("ZZEXACT");
            StockMaster exactSymbol = persistStock(exactSymbolTicker, "Some Company " + exactSymbolTicker, "NSE", null, true);
            // company name contains the ticker as a substring, but its own symbol doesn't match exactly
            persistStock(uniqueSymbol("ZZOTHER"), exactSymbolTicker + " Steel Alloys", "NSE", null, true);
            entityManager.flush();

            List<StockMaster> results = stockMasterRepository.search(exactSymbolTicker, Pageable.ofSize(10));

            assertThat(results.get(0).getId()).isEqualTo(exactSymbol.getId());
        }
    }

    @Test
    @DisplayName("findBySymbolAndExchange finds the exact symbol+exchange pair")
    void findBySymbolAndExchangeFindsExact() {
        String symbol = uniqueSymbol("ZZFIND");
        persistStock(symbol, "Findable Ltd", "NSE", null, true);
        entityManager.flush();

        Optional<StockMaster> found = stockMasterRepository.findBySymbolAndExchange(symbol, "NSE");
        Optional<StockMaster> notFound = stockMasterRepository.findBySymbolAndExchange(symbol, "BSE");

        assertThat(found).isPresent();
        assertThat(notFound).isEmpty();
    }

    @Test
    @DisplayName("countByExchange scopes strictly by exchange, verified via a before/after delta against the shared DB")
    void countByExchangeScopesStrictly() {
        long nseBefore = stockMasterRepository.countByExchange("NSE");
        long bseBefore = stockMasterRepository.countByExchange("BSE");
        persistStock(uniqueSymbol("ZZN1"), "NSE Co 1", "NSE", null, true);
        persistStock(uniqueSymbol("ZZB1"), "BSE Co 1", "BSE", null, true);
        persistStock(uniqueSymbol("ZZN2"), "NSE Co 2", "NSE", null, true);
        entityManager.flush();

        assertThat(stockMasterRepository.countByExchange("NSE") - nseBefore).isEqualTo(2);
        assertThat(stockMasterRepository.countByExchange("BSE") - bseBefore).isEqualTo(1);
    }

    @Test
    @DisplayName("findAltSymbolsByIsin returns entries whose ISIN matches but symbol isn't already in the bhavcopy set")
    void findAltSymbolsByIsinFiltersCorrectly() {
        String symbol = uniqueSymbol("ZZALT");
        String isin = "INZZ" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        persistStock(symbol, "Alt Symbol Co", "NSE", isin, true);
        entityManager.flush();

        List<Object[]> results = stockMasterRepository.findAltSymbolsByIsin(
                List.of(isin), List.of("SOME-OTHER-BHAV-SYMBOL")); // bhavcopy uses a different symbol

        assertThat(results).hasSize(1);
        assertThat(results.get(0)[0]).isEqualTo(symbol);
    }
}
