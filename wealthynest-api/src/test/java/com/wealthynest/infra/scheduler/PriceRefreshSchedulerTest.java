package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.investment.entity.GoldPriceCache;
import com.wealthynest.domain.investment.entity.MFNavCache;
import com.wealthynest.domain.investment.repository.GoldPriceCacheRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.investment.repository.MFNavCacheRepository;
import com.wealthynest.domain.investment.repository.StockPriceCacheRepository;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.external.ExternalPriceService.GoldPriceData;
import com.wealthynest.infra.external.ExternalPriceService.MFNavData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PriceRefreshSchedulerTest {

    @Mock private InvestmentRepository      investmentRepository;
    @Mock private StockPriceCacheRepository stockPriceCacheRepository;
    @Mock private GoldPriceCacheRepository  goldPriceCacheRepository;
    @Mock private MFNavCacheRepository      mfNavCacheRepository;
    @Mock private ExternalPriceService      externalPriceService;

    @InjectMocks
    private PriceRefreshScheduler scheduler;

    // ── Shared factory helpers ────────────────────────────────────────────────────

    private GoldPriceData goldData(BigDecimal p22, BigDecimal p24, BigDecimal p18,
                                    BigDecimal spotUsd, BigDecimal usdInr) {
        return new GoldPriceData(p22, p24, p18, spotUsd, usdInr);
    }

    private MFNavData navData(BigDecimal nav, String navDate, String schemeName, String fundHouse) {
        return new MFNavData(nav, navDate, schemeName, fundHouse);
    }

    // ─── RefreshGoldPriceTests ────────────────────────────────────────────────────

    @Nested
    @DisplayName("refreshGoldPrice")
    class RefreshGoldPriceTests {

        @Test
        @DisplayName("fetch returns null → no cache update, no bulk update")
        void fetchReturnsNull_noCacheUpdate_noBulkUpdate() {
            when(externalPriceService.fetchGoldPriceDataFresh()).thenReturn(null);

            scheduler.refreshGoldPrice();

            verifyNoInteractions(goldPriceCacheRepository);
            verify(investmentRepository, never()).bulkUpdateGoldPrice(any(), any(), any());
        }

        @Test
        @DisplayName("fetch returns data with null price22k → guarded early return, no cache update")
        void fetchReturnsNullPrice22k_noCacheUpdate() {
            when(externalPriceService.fetchGoldPriceDataFresh())
                .thenReturn(goldData(null, new BigDecimal("7000"), new BigDecimal("5600"), null, null));

            scheduler.refreshGoldPrice();

            verifyNoInteractions(goldPriceCacheRepository);
            verify(investmentRepository, never()).bulkUpdateGoldPrice(any(), any(), any());
        }

        @Test
        @DisplayName("all prices present → existing cache row updated and bulk update called with correct values")
        void happyPath_allPricesPresent_cacheAndBulkUpdateCalled() {
            BigDecimal p22 = new BigDecimal("6000");
            BigDecimal p24 = new BigDecimal("7000");
            BigDecimal p18 = new BigDecimal("5000");
            when(externalPriceService.fetchGoldPriceDataFresh())
                .thenReturn(goldData(p22, p24, p18, new BigDecimal("1900"), new BigDecimal("83")));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(goldPriceCacheRepository.save(any())).thenReturn(new GoldPriceCache());
            when(investmentRepository.bulkUpdateGoldPrice(any(), any(), any())).thenReturn(5);

            scheduler.refreshGoldPrice();

            ArgumentCaptor<GoldPriceCache> cacheCaptor = ArgumentCaptor.forClass(GoldPriceCache.class);
            verify(goldPriceCacheRepository).save(cacheCaptor.capture());
            GoldPriceCache saved = cacheCaptor.getValue();
            assertThat(saved.getPrice22kPerGram()).isEqualByComparingTo(p22);
            assertThat(saved.getPrice24kPerGram()).isEqualByComparingTo(p24);
            assertThat(saved.getPrice18kPerGram()).isEqualByComparingTo(p18);
            assertThat(saved.getLastUpdated()).isNotNull();

            // bulkUpdate receives (p22, p18, p24) in that parameter order
            verify(investmentRepository).bulkUpdateGoldPrice(p22, p18, p24);
        }

        @Test
        @DisplayName("price18k and price24k both null → both fall back to p22 in bulk update call")
        void price18kAndPrice24kNull_fallbackToP22kForBothParams() {
            BigDecimal p22 = new BigDecimal("6000");
            when(externalPriceService.fetchGoldPriceDataFresh())
                .thenReturn(goldData(p22, null, null, null, null));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(goldPriceCacheRepository.save(any())).thenReturn(new GoldPriceCache());

            scheduler.refreshGoldPrice();

            // p18 fallback → p22, p24 fallback → p22
            verify(investmentRepository).bulkUpdateGoldPrice(p22, p22, p22);
        }

        @Test
        @DisplayName("only price24k is null → price24 parameter falls back to p22, price18 is unchanged")
        void price24kNull_onlyPrice24FallsBack() {
            BigDecimal p22 = new BigDecimal("6000");
            BigDecimal p18 = new BigDecimal("5000");
            when(externalPriceService.fetchGoldPriceDataFresh())
                .thenReturn(goldData(p22, null, p18, null, null));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(goldPriceCacheRepository.save(any())).thenReturn(new GoldPriceCache());

            scheduler.refreshGoldPrice();

            verify(investmentRepository).bulkUpdateGoldPrice(p22, p18, p22);
        }

        @Test
        @DisplayName("fetch throws RuntimeException → exception swallowed, method completes normally")
        void exceptionThrown_logsAndContinues_noException() {
            when(externalPriceService.fetchGoldPriceDataFresh())
                .thenThrow(new RuntimeException("Network timeout"));

            assertThatCode(() -> scheduler.refreshGoldPrice()).doesNotThrowAnyException();

            verifyNoInteractions(goldPriceCacheRepository);
            verify(investmentRepository, never()).bulkUpdateGoldPrice(any(), any(), any());
        }
    }

    // ─── RefreshMFNavTests ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("refreshMFNav")
    class RefreshMFNavTests {

        @Test
        @DisplayName("no active MF scheme codes → fetchMFNav never called")
        void noActiveSchemes_noFetchCalls() {
            when(investmentRepository.findDistinctActiveSchemeCodesForMF())
                .thenReturn(Collections.emptyList());

            scheduler.refreshMFNav();

            verify(externalPriceService, never()).fetchMFNav(anyString());
            verifyNoInteractions(mfNavCacheRepository);
        }

        @Test
        @DisplayName("nav fetch returns null for a scheme → scheme skipped, no cache save or bulk update")
        void navFetchReturnsNull_schemeSkipped_noBulkUpdate() {
            when(investmentRepository.findDistinctActiveSchemeCodesForMF())
                .thenReturn(List.of("120503"));
            when(externalPriceService.fetchMFNav("120503")).thenReturn(null);

            scheduler.refreshMFNav();

            verify(mfNavCacheRepository, never()).save(any());
            verify(investmentRepository, never()).bulkUpdateNavBySchemeCode(anyString(), any());
        }

        @Test
        @DisplayName("happy path single scheme → cache saved with all fields and bulk update called")
        void happyPath_cacheUpdatedAndBulkUpdateCalled() {
            String code = "120503";
            BigDecimal nav = new BigDecimal("45.67");
            when(investmentRepository.findDistinctActiveSchemeCodesForMF()).thenReturn(List.of(code));
            when(externalPriceService.fetchMFNav(code))
                .thenReturn(navData(nav, "01-07-2026", "HDFC Equity Fund", "HDFC AMC"));
            when(mfNavCacheRepository.findById(code)).thenReturn(Optional.empty());
            when(mfNavCacheRepository.save(any())).thenReturn(new MFNavCache());
            when(investmentRepository.bulkUpdateNavBySchemeCode(code, nav)).thenReturn(3);

            scheduler.refreshMFNav();

            ArgumentCaptor<MFNavCache> cacheCaptor = ArgumentCaptor.forClass(MFNavCache.class);
            verify(mfNavCacheRepository).save(cacheCaptor.capture());
            MFNavCache saved = cacheCaptor.getValue();
            assertThat(saved.getNav()).isEqualByComparingTo(nav);
            assertThat(saved.getSchemeName()).isEqualTo("HDFC Equity Fund");
            assertThat(saved.getFundHouse()).isEqualTo("HDFC AMC");
            assertThat(saved.getLastUpdated()).isNotNull();
            verify(investmentRepository).bulkUpdateNavBySchemeCode(code, nav);
        }

        @Test
        @DisplayName("two scheme codes → each gets its own cache save and bulk update call")
        void multipleSchemes_eachGetsIndependentCacheAndBulkUpdate() {
            String code1 = "120503", code2 = "119551";
            BigDecimal nav1 = new BigDecimal("45.67"), nav2 = new BigDecimal("89.12");
            when(investmentRepository.findDistinctActiveSchemeCodesForMF())
                .thenReturn(List.of(code1, code2));
            when(externalPriceService.fetchMFNav(code1))
                .thenReturn(navData(nav1, "01-07-2026", "HDFC Equity", "HDFC"));
            when(externalPriceService.fetchMFNav(code2))
                .thenReturn(navData(nav2, "01-07-2026", "Axis Bluechip", "Axis"));
            when(mfNavCacheRepository.findById(anyString())).thenReturn(Optional.empty());
            when(mfNavCacheRepository.save(any())).thenReturn(new MFNavCache());
            when(investmentRepository.bulkUpdateNavBySchemeCode(anyString(), any())).thenReturn(2);

            scheduler.refreshMFNav();

            verify(mfNavCacheRepository, times(2)).save(any(MFNavCache.class));
            verify(investmentRepository).bulkUpdateNavBySchemeCode(code1, nav1);
            verify(investmentRepository).bulkUpdateNavBySchemeCode(code2, nav2);
        }

        @Test
        @DisplayName("navDate in dd-MM-yyyy format → parsed and stored as LocalDate in cache")
        void navDateParsed_storedInCache() {
            String code = "120503";
            when(investmentRepository.findDistinctActiveSchemeCodesForMF()).thenReturn(List.of(code));
            when(externalPriceService.fetchMFNav(code))
                .thenReturn(navData(new BigDecimal("50.00"), "01-07-2026", "Test Scheme", "Test House"));
            when(mfNavCacheRepository.findById(code)).thenReturn(Optional.empty());
            when(mfNavCacheRepository.save(any())).thenReturn(new MFNavCache());
            when(investmentRepository.bulkUpdateNavBySchemeCode(anyString(), any())).thenReturn(1);

            scheduler.refreshMFNav();

            ArgumentCaptor<MFNavCache> captor = ArgumentCaptor.forClass(MFNavCache.class);
            verify(mfNavCacheRepository).save(captor.capture());
            assertThat(captor.getValue().getNavDate()).isEqualTo(LocalDate.of(2026, 7, 1));
        }
    }
}
