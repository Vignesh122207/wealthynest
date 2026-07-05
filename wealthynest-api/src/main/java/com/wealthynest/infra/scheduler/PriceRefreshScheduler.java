package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.external.ExternalPriceService.GoldPriceData;
import com.wealthynest.infra.external.ExternalPriceService.MFNavData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;


// Stock prices now come from NSE bhavcopy via StockDataService.updateEODPrices() (NSE_EOD job).
// This scheduler handles only gold and MF NAV.

@Slf4j
@Component
@RequiredArgsConstructor
public class PriceRefreshScheduler {

    private final InvestmentRepository        investmentRepository;
    private final StockPriceCacheRepository   stockPriceCacheRepository;
    private final GoldPriceCacheRepository    goldPriceCacheRepository;
    private final MFNavCacheRepository        mfNavCacheRepository;
    private final ExternalPriceService        externalPriceService;

    // Scheduling is managed by JobSchedulerService — no @Scheduled annotations here.

    @Transactional
    public void refreshGoldPrice() {
        try {
            GoldPriceData data = externalPriceService.fetchGoldPriceDataFresh();
            if (data == null || data.price22k() == null) {
                log.warn("Gold price fetch returned null — skipping cache update");
                return;
            }

            // Update the single gold price cache row
            GoldPriceCache cache = goldPriceCacheRepository.findById(1)
                .orElse(GoldPriceCache.builder().id(1).build());
            cache.setPrice22kPerGram(data.price22k());
            if (data.price24k() != null) cache.setPrice24kPerGram(data.price24k());
            if (data.price18k() != null) cache.setPrice18kPerGram(data.price18k());
            if (data.spotUsd()  != null) cache.setSpotUsdPerOz(data.spotUsd());
            if (data.usdInr()   != null) cache.setUsdInrRate(data.usdInr());
            cache.setLastUpdated(Instant.now());
            goldPriceCacheRepository.save(cache);

            // Single SQL UPDATE handles all karats and all users in one round-trip
            BigDecimal p22 = data.price22k();
            BigDecimal p18 = data.price18k() != null ? data.price18k() : p22;
            BigDecimal p24 = data.price24k() != null ? data.price24k() : p22;
            int rows = investmentRepository.bulkUpdateGoldPrice(p22, p18, p24);
            log.info("Gold price refresh: 24K=₹{}/g, 22K=₹{}/g, 18K=₹{}/g — {} investment rows updated",
                data.price24k(), data.price22k(), data.price18k(), rows);
        } catch (Exception e) {
            log.warn("Gold price refresh failed: {}", e.getMessage());
        }
    }

    @Transactional
    public void refreshMFNav() {
        // Single DB query for distinct scheme codes — no full table scan
        List<String> schemeCodes = investmentRepository.findDistinctActiveSchemeCodesForMF();

        DateTimeFormatter mfFmt = DateTimeFormatter.ofPattern("dd-MM-yyyy");
        int totalRows = 0;
        for (String code : schemeCodes) {
            try {
                MFNavData nav = externalPriceService.fetchMFNav(code);
                if (nav == null || nav.nav() == null) continue;

                // Update NAV cache
                MFNavCache cache = mfNavCacheRepository.findById(code)
                    .orElse(MFNavCache.builder().schemeCode(code).build());
                cache.setNav(nav.nav());
                cache.setSchemeName(nav.schemeName());
                cache.setFundHouse(nav.fundHouse());
                if (nav.navDate() != null) {
                    try { cache.setNavDate(LocalDate.parse(nav.navDate(), mfFmt)); } catch (Exception ignored) {}
                }
                cache.setLastUpdated(Instant.now());
                mfNavCacheRepository.save(cache);

                // Single bulk UPDATE per scheme code — O(1) round-trip regardless of holders
                int rows = investmentRepository.bulkUpdateNavBySchemeCode(code, nav.nav());
                totalRows += rows;
            } catch (Exception e) {
                log.warn("MF NAV refresh failed for {}: {}", code, e.getMessage());
            }
        }
        log.info("MF NAV refresh complete: {} schemes, {} investment rows updated", schemeCodes.size(), totalRows);
    }

}
