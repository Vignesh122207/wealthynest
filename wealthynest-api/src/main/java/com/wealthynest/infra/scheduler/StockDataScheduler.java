package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.investment.repository.StockMasterRepository;
import com.wealthynest.domain.investment.repository.StockPriceCacheRepository;
import com.wealthynest.infra.external.StockDataService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;

@Slf4j
@Component
@RequiredArgsConstructor
public class StockDataScheduler {

    private final StockDataService          stockDataService;
    private final StockMasterRepository     stockMasterRepository;
    private final StockPriceCacheRepository stockPriceCacheRepository;

    /**
     * After full startup:
     * 1. Refresh NSE master if empty or stale (< 500 symbols — live NSE has 2400+).
     * 2. Warm EOD price cache from most recent bhavcopy.
     */
    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (stockMasterRepository.countByExchange("NSE") < 500) {
            log.info("Triggering initial NSE master download …");
            stockDataService.refreshNSEMaster();
        }

        if (stockMasterRepository.countByExchange("BSE") < 500) {
            log.info("Triggering initial BSE master download …");
            stockDataService.refreshBSEMaster();
        }

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));

        if (stockPriceCacheRepository.count() == 0) {
            log.info("Price cache empty — loading recent EOD prices from bhavcopy …");
            for (int i = 0; i <= 5; i++) {
                LocalDate date = today.minusDays(i);
                if (isWeekend(date)) continue;
                int updated = stockDataService.updateEODPrices(date);
                if (updated > 0) {
                    log.info("Loaded EOD prices for {} — {} symbols updated", date, updated);
                    break;
                }
            }
        }

        // Corporate actions (dividends) are populated when AUTO_INCOME job runs via Yahoo Finance.
        // NSE CA files are not available as static downloads; data comes from Yahoo at 8 PM daily.
    }

    /**
     * Weekly — Sunday 2 AM IST: refresh full NSE equity list + full corporate actions list.
     * Catches any gaps in the daily CA files (holidays, network issues).
     */
    @Async
    @Scheduled(cron = "0 0 2 * * SUN", zone = "Asia/Kolkata")
    public void weeklyMasterRefresh() {
        log.info("Weekly stock master refresh starting …");
        int nseStocks = stockDataService.refreshNSEMaster();
        int bseStocks = stockDataService.refreshBSEMaster();
        int caEvents  = stockDataService.refreshCorporateActions();
        log.info("Weekly refresh done: {} NSE stocks, {} BSE stocks, {} CA events", nseStocks, bseStocks, caEvents);
    }

    // dailyEODUpdate() removed — now handled by JobSchedulerService via NSE_EOD job (6 PM IST weekdays).
    // This avoids duplicate runs and enables admin-panel manual trigger + configurable cron.

    private boolean isWeekend(LocalDate d) {
        return d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY;
    }
}
