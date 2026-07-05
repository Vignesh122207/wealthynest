package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.infra.external.ExternalPriceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class AutoIncomeScheduler {

    private final InvestmentRepository         investmentRepository;
    private final NseCorporateActionRepository corporateActionRepository;
    private final InvestmentIncomeLogRepository incomeLogRepository;
    private final IncomeRepository             incomeRepository;
    private final ExternalPriceService         externalPriceService;
    private final StockPriceCacheRepository    stockPriceCacheRepository;

    // Self-injection via @Lazy to call @Transactional methods through the Spring proxy
    @Lazy @Autowired
    private AutoIncomeScheduler self;

    /** Called by JobSchedulerService on cron and on manual trigger. No outer transaction — each investment processes in its own transaction. */
    public void runAllAutoIncome() {
        processDividends();
        processBondCoupons();
        processFDInterestAndMaturity();
        seedMissingStockPrices();
    }

    // ─── Dividends (Yahoo Finance query2 — no crumb, sequential with 2s delay) ──

    private void processDividends() {
        // Group by symbol — one Yahoo API call per distinct symbol regardless of how many
        // users hold it. This changes time complexity from O(total_investments) to O(symbols).
        Map<String, List<Investment>> bySymbol = investmentRepository
            .findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)
            .stream()
            .filter(i -> i.getSymbol() != null && i.getPurchaseDate() != null)
            .collect(Collectors.groupingBy(Investment::getSymbol));

        int idx = 0;
        for (Map.Entry<String, List<Investment>> entry : bySymbol.entrySet()) {
            if (idx++ > 0) {
                try { Thread.sleep(2000); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); return;
                }
            }
            self.processSymbolDividends(entry.getKey(), entry.getValue());
        }
    }

    @Transactional
    public void processSingleStockDividends(Investment inv) {
        long fromEpoch = inv.getPurchaseDate().atStartOfDay()
            .toInstant(java.time.ZoneOffset.UTC).getEpochSecond();
        Map<String, BigDecimal> divHistory;
        try {
            divHistory = externalPriceService.fetchDividendHistory(yahooTicker(inv), fromEpoch);
        } catch (RuntimeException e) {
            // fetchDividendHistory throws only after exhausting its own retries — skip this stock
            // in the current batch run; the next scheduled run will try again.
            log.warn("Dividend processing skipped for {} (Yahoo unavailable after retries): {}",
                inv.getSymbol(), e.getMessage());
            return;
        }

        try {
            LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
            for (Map.Entry<String, BigDecimal> entry : divHistory.entrySet()) {
                LocalDate  exDate   = LocalDate.parse(entry.getKey());
                BigDecimal perShare = entry.getValue();
                if (exDate.isBefore(inv.getPurchaseDate())) continue;
                if (exDate.isAfter(LocalDate.now())) continue;
                if (perShare == null || perShare.compareTo(BigDecimal.ZERO) <= 0) continue;

                // Always save to corporate actions — used for display in investment history
                if (!corporateActionRepository.existsBySymbolAndActionTypeAndExDate(
                        inv.getSymbol(), "DIVIDEND", exDate)) {
                    corporateActionRepository.save(NseCorporateAction.builder()
                        .symbol(inv.getSymbol()).actionType("DIVIDEND")
                        .exDate(exDate).dividendPerShare(perShare).build());
                }

                // Only credit income for current month onward (not historical backfill)
                if (exDate.isBefore(monthStart)) continue;

                if (incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                        inv.getId(), "DIVIDEND", exDate)) continue;

                BigDecimal units    = inv.getUnits() != null ? inv.getUnits() : BigDecimal.ONE;
                BigDecimal totalDiv = perShare.multiply(units).setScale(2, RoundingMode.HALF_UP);

                IncomeEntry income = createIncome(inv, totalDiv, exDate, IncomeSource.DIVIDEND,
                    "Dividend: " + inv.getSymbol() + " ₹" + perShare + "/share");
                saveIncomeLog(inv, income, "DIVIDEND", exDate, totalDiv);
                log.info("Dividend ₹{} for {} on {}", totalDiv, inv.getSymbol(), exDate);
            }
        } catch (Exception e) {
            log.warn("Dividend processing failed for {}: {}", inv.getSymbol(), e.getMessage());
        }
    }

    /**
     * Fetches dividend history from Yahoo ONCE for a symbol, then credits each holder's investment.
     * Replaces per-investment Yahoo calls — at scale this is O(distinct_symbols) API calls,
     * not O(total_stock_investments).
     */
    @Transactional
    public void processSymbolDividends(String symbol, List<Investment> investments) {
        // Use the first investment's exchange to build the Yahoo ticker (all same symbol → same exchange)
        Investment representative = investments.get(0);
        Map<String, BigDecimal> divHistory;
        try {
            long earliestEpoch = investments.stream()
                .map(i -> i.getPurchaseDate().atStartOfDay().toInstant(java.time.ZoneOffset.UTC).getEpochSecond())
                .min(Long::compareTo).orElse(0L);
            divHistory = externalPriceService.fetchDividendHistory(yahooTicker(representative), earliestEpoch);
        } catch (RuntimeException e) {
            log.warn("Dividend processing skipped for {} (Yahoo unavailable after retries): {}", symbol, e.getMessage());
            return;
        }
        if (divHistory.isEmpty()) return;

        LocalDate today      = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);

        // Corporate actions are per-symbol — save once, not once per holder
        for (Map.Entry<String, BigDecimal> entry : divHistory.entrySet()) {
            LocalDate  exDate   = LocalDate.parse(entry.getKey());
            BigDecimal perShare = entry.getValue();
            if (perShare == null || perShare.compareTo(BigDecimal.ZERO) <= 0) continue;
            if (exDate.isAfter(today)) continue;
            if (!corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate)) {
                corporateActionRepository.save(NseCorporateAction.builder()
                    .symbol(symbol).actionType("DIVIDEND")
                    .exDate(exDate).dividendPerShare(perShare).build());
            }
        }

        // Credit income per investment (each user bought at a different date and holds different units)
        for (Investment inv : investments) {
            try {
                for (Map.Entry<String, BigDecimal> entry : divHistory.entrySet()) {
                    LocalDate  exDate   = LocalDate.parse(entry.getKey());
                    BigDecimal perShare = entry.getValue();
                    if (perShare == null || perShare.compareTo(BigDecimal.ZERO) <= 0) continue;
                    if (exDate.isBefore(inv.getPurchaseDate())) continue;
                    if (exDate.isAfter(today)) continue;
                    if (exDate.isBefore(monthStart)) continue;
                    if (incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                            inv.getId(), "DIVIDEND", exDate)) continue;
                    BigDecimal units    = inv.getUnits() != null ? inv.getUnits() : BigDecimal.ONE;
                    BigDecimal totalDiv = perShare.multiply(units).setScale(2, RoundingMode.HALF_UP);
                    IncomeEntry income  = createIncome(inv, totalDiv, exDate, IncomeSource.DIVIDEND,
                        "Dividend: " + symbol + " ₹" + perShare + "/share");
                    saveIncomeLog(inv, income, "DIVIDEND", exDate, totalDiv);
                    log.info("Dividend ₹{} for {} (inv {}) on {}", totalDiv, symbol, inv.getId(), exDate);
                }
            } catch (Exception e) {
                log.warn("Dividend crediting failed for investment {} ({}): {}", inv.getId(), symbol, e.getMessage());
            }
        }
    }

    private static final int   BACKFILL_MAX_ATTEMPTS  = 3;
    private static final long  BACKFILL_RETRY_DELAY_MS = 30_000; // 30 s between high-level retries

    /**
     * Backfills dividend history for a newly added stock from its purchase date.
     * First checks the nse_corporate_actions DB cache (instant, no API call).
     * Falls back to Yahoo Finance if the symbol isn't cached yet.
     * Retries up to {@value #BACKFILL_MAX_ATTEMPTS} times (with {@value #BACKFILL_RETRY_DELAY_MS} ms
     * between attempts) to survive transient Yahoo Finance rate-limits or timeouts.
     * Must be called AFTER the enclosing transaction commits (use afterCommit hook).
     */
    @Async
    public void backfillDividendsForStock(Investment inv) {
        if (inv.getSymbol() == null || inv.getPurchaseDate() == null) return;

        // Issue #10: always fetch a fresh live price from Yahoo for a newly added stock;
        // the existing cache may contain yesterday's EOD price, so we bypass it here.
        BigDecimal livePrice = null;
        try {
            livePrice = externalPriceService.fetchStockPrice(yahooTicker(inv));
        } catch (Exception e) {
            log.warn("Live price fetch failed for {} after add: {}", inv.getSymbol(), e.getMessage());
        }
        if (livePrice == null) {
            // Fall back to cache if Yahoo is unavailable
            livePrice = stockPriceCacheRepository.findById(inv.getSymbol())
                .map(StockPriceCache::getCurrentPrice).orElse(null);
        }
        if (livePrice != null) {
            // Update / insert the cache with the fresh price
            stockPriceCacheRepository.save(StockPriceCache.builder()
                .symbol(inv.getSymbol()).exchange("NSE")
                .currentPrice(livePrice).lastUpdated(Instant.now()).build());
            final BigDecimal finalPrice = livePrice;
            investmentRepository.findById(inv.getId()).ifPresent(i -> {
                i.setCurrentPrice(finalPrice);
                if (i.getUnits() != null)
                    i.setCurrentValue(i.getUnits().multiply(finalPrice));
                investmentRepository.save(i);
            });
            log.info("Current value set to ₹{}/share × {} units for {} ({})",
                livePrice, inv.getUnits(), inv.getSymbol(), inv.getId());
        }

        log.info("Backfilling dividends for {} from {}", inv.getSymbol(), inv.getPurchaseDate());
        for (int attempt = 1; attempt <= BACKFILL_MAX_ATTEMPTS; attempt++) {
            boolean ok = attemptDividendBackfill(inv, attempt);
            if (ok) return;
            if (attempt < BACKFILL_MAX_ATTEMPTS) {
                log.warn("Dividend backfill attempt {}/{} failed for {} — retrying in {} s",
                    attempt, BACKFILL_MAX_ATTEMPTS, inv.getSymbol(), BACKFILL_RETRY_DELAY_MS / 1000);
                try { Thread.sleep(BACKFILL_RETRY_DELAY_MS); }
                catch (InterruptedException ie) { Thread.currentThread().interrupt(); return; }
            }
        }
        log.error("Dividend backfill for {} exhausted all {} attempts — will be picked up by nightly AUTO_INCOME job",
            inv.getSymbol(), BACKFILL_MAX_ATTEMPTS);
    }

    /**
     * Single attempt at backfilling dividends for a newly added stock.
     * Returns true  — Yahoo responded (even if no dividends; stock may genuinely pay none).
     * Returns false — Yahoo call failed after its own retries (transient error); outer loop will retry.
     */
    @Transactional
    public boolean attemptDividendBackfill(Investment inv, int attempt) {
        long fromEpoch = inv.getPurchaseDate().atStartOfDay()
            .toInstant(java.time.ZoneOffset.UTC).getEpochSecond();
        Map<String, BigDecimal> divHistory;
        try {
            divHistory = externalPriceService.fetchDividendHistory(yahooTicker(inv), fromEpoch);
        } catch (RuntimeException e) {
            // fetchDividendHistory throws only when all its internal retries are exhausted
            log.warn("Dividend backfill attempt {}/{} failed for {}: {}",
                attempt, BACKFILL_MAX_ATTEMPTS, inv.getSymbol(), e.getMessage());
            return false;
        }

        // Empty map = Yahoo responded but stock has no dividends in the period — that's fine
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        for (Map.Entry<String, BigDecimal> entry : divHistory.entrySet()) {
            LocalDate  exDate   = LocalDate.parse(entry.getKey());
            BigDecimal perShare = entry.getValue();
            if (exDate.isBefore(inv.getPurchaseDate())) continue;
            if (exDate.isAfter(LocalDate.now())) continue;
            if (perShare == null || perShare.compareTo(BigDecimal.ZERO) <= 0) continue;

            // Always save to corporate actions — used for display in investment history
            if (!corporateActionRepository.existsBySymbolAndActionTypeAndExDate(
                    inv.getSymbol(), "DIVIDEND", exDate)) {
                corporateActionRepository.save(NseCorporateAction.builder()
                    .symbol(inv.getSymbol()).actionType("DIVIDEND")
                    .exDate(exDate).dividendPerShare(perShare).build());
            }

            // Only credit income for current month onward (not historical backfill)
            if (exDate.isBefore(monthStart)) continue;

            if (incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    inv.getId(), "DIVIDEND", exDate)) continue;

            BigDecimal units    = inv.getUnits() != null ? inv.getUnits() : BigDecimal.ONE;
            BigDecimal totalDiv = perShare.multiply(units).setScale(2, RoundingMode.HALF_UP);

            IncomeEntry income = createIncome(inv, totalDiv, exDate, IncomeSource.DIVIDEND,
                "Dividend: " + inv.getSymbol() + " ₹" + perShare + "/share");
            saveIncomeLog(inv, income, "DIVIDEND", exDate, totalDiv);
            log.info("Credited dividend ₹{} for {} on {}", totalDiv, inv.getSymbol(), exDate);
        }
        return true;
    }

    // ─── Bond coupons ─────────────────────────────────────────────────────────

    private void processBondCoupons() {
        investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.BOND)
            .stream()
            .filter(i -> i.getCouponRate() != null && i.getCouponFrequency() != null
                && i.getPurchaseDate() != null)
            .forEach(b -> self.processSingleBondCoupons(b));
    }

    @Transactional
    public void processSingleBondCoupons(Investment bond) {
        try {
            int paymentsPerYear = paymentsPerYear(bond.getCouponFrequency());
            // Coupon is on face value × units, not purchase price (which may differ at discount/premium)
            BigDecimal fv = bond.getFaceValue() != null ? bond.getFaceValue() : bond.getAvgBuyPrice();
            BigDecimal faceValueTotal = fv != null && bond.getUnits() != null
                ? fv.multiply(bond.getUnits())
                : bond.getInvestedAmount();
            BigDecimal grossCoupon = faceValueTotal
                .multiply(bond.getCouponRate())
                .divide(BigDecimal.valueOf(100L * paymentsPerYear), 2, RoundingMode.HALF_UP);
            // Issue #12: apply TDS deduction — net coupon = gross × (1 − tdsRate/100)
            BigDecimal tdsRate = bond.getTdsRate() != null ? bond.getTdsRate() : BigDecimal.ZERO;
            BigDecimal couponAmt = tdsRate.compareTo(BigDecimal.ZERO) > 0
                ? grossCoupon.multiply(BigDecimal.ONE.subtract(
                    tdsRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)))
                    .setScale(2, RoundingMode.HALF_UP)
                : grossCoupon;

            LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
            for (LocalDate cpDate : generateCouponDates(
                    bond.getPurchaseDate(), bond.getMaturityDate(), bond.getCouponFrequency(), bond.getCouponCreditDay())) {
                if (cpDate.isAfter(LocalDate.now())) continue;
                // Only credit coupons from current month onward; historical coupons are display-only
                if (cpDate.isBefore(monthStart)) continue;
                if (incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                        bond.getId(), "BOND_COUPON", cpDate)) continue;

                IncomeEntry income = createIncome(bond, couponAmt, cpDate, IncomeSource.INTEREST,
                    "Bond coupon: " + bond.getCompanyName() + " @ " + bond.getCouponRate() + "%");
                saveIncomeLog(bond, income, "BOND_COUPON", cpDate, couponAmt);
                log.info("Bond coupon ₹{} for {} on {}", couponAmt, bond.getId(), cpDate);
            }
        } catch (Exception e) {
            log.warn("Bond coupon processing failed for {}: {}", bond.getId(), e.getMessage());
        }
    }

    @Async
    @Transactional
    public void backfillBondCoupons(Investment bond) {
        if (bond.getCouponRate() == null || bond.getPurchaseDate() == null) return;
        log.info("Backfilling bond coupons for {} from {}", bond.getId(), bond.getPurchaseDate());
        processSingleBondCoupons(bond);
    }

    // ─── FD interest & maturity ───────────────────────────────────────────────

    private void processFDInterestAndMaturity() {
        investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.FD)
            .stream()
            .filter(i -> i.getCouponRate() != null && i.getPurchaseDate() != null)
            .forEach(fd -> self.processSingleFD(fd));
    }

    @Transactional
    public void processSingleFD(Investment fd) {
        try {
            LocalDate maturity = fd.getMaturityDate();
            if (maturity == null || maturity.isAfter(LocalDate.now())) return;

            if (incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    fd.getId(), "FD_MATURITY", maturity)) return;

            BigDecimal interest = calculateFDInterest(fd);
            IncomeEntry income = createIncome(fd, interest, maturity, IncomeSource.INTEREST,
                "FD maturity: " + fd.getBankName() + " ₹" + fd.getInvestedAmount() + " @ " + fd.getCouponRate() + "%");
            saveIncomeLog(fd, income, "FD_MATURITY", maturity, interest);

            fd.setActive(false);
            investmentRepository.save(fd);
            log.info("FD maturity ₹{} for {} on {}", interest, fd.getId(), maturity);
        } catch (Exception e) {
            log.warn("FD maturity processing failed for {}: {}", fd.getId(), e.getMessage());
        }
    }

    @Async
    @Transactional
    public void backfillFDMaturity(Investment fd) {
        if (fd.getCouponRate() == null || fd.getPurchaseDate() == null) return;
        log.info("Checking FD maturity backfill for {}", fd.getId());
        processSingleFD(fd);
    }

    // ─── Stock price seed ─────────────────────────────────────────────────────

    /** Seeds live Yahoo price for all active STOCK investments that have no StockPriceCache entry. */
    public void seedMissingStockPrices() {
        // Collect distinct symbols across all active stock holdings
        List<Investment> stocks = investmentRepository.findAll().stream()
            .filter(i -> i.isActive() && i.getInvestmentType() == InvestmentType.STOCK
                && i.getSymbol() != null)
            .toList();

        // Deduplicate by symbol so we make one Yahoo call per symbol
        java.util.LinkedHashMap<String, Investment> bySymbol = new java.util.LinkedHashMap<>();
        for (Investment inv : stocks) bySymbol.putIfAbsent(inv.getSymbol(), inv);

        if (bySymbol.isEmpty()) return;
        log.info("Refreshing live prices for {} distinct stock symbols via Yahoo Finance", bySymbol.size());

        int idx = 0;
        for (Map.Entry<String, Investment> e : bySymbol.entrySet()) {
            if (idx++ > 0) {
                try { Thread.sleep(1000); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt(); return;
                }
            }
            String symbol = e.getKey();
            Investment inv = e.getValue();
            try {
                BigDecimal price = externalPriceService.fetchStockPrice(yahooTicker(inv));
                if (price == null) { log.warn("Yahoo returned null price for {}", symbol); continue; }

                // Upsert cache
                StockPriceCache cache = stockPriceCacheRepository.findById(symbol)
                    .orElse(StockPriceCache.builder().symbol(symbol)
                        .exchange(inv.getExchange() != null ? inv.getExchange() : "NSE").build());
                if (cache.getCurrentPrice() != null) {
                    BigDecimal prev = cache.getCurrentPrice();
                    cache.setPreviousClose(prev);
                    BigDecimal chg = price.subtract(prev);
                    cache.setDayChange(chg);
                    if (prev.compareTo(BigDecimal.ZERO) > 0)
                        cache.setDayChangePct(chg.divide(prev, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)));
                }
                cache.setCurrentPrice(price);
                cache.setLastUpdated(Instant.now());
                stockPriceCacheRepository.save(cache);

                // Single bulk UPDATE for all users holding this symbol — O(1) round-trip
                int rows = investmentRepository.bulkUpdatePriceBySymbol(symbol, price);
                log.info("Refreshed ₹{} for {} ({} investment rows)", price, symbol, rows);
            } catch (Exception ex) {
                log.warn("Price refresh failed for {}: {}", symbol, ex.getMessage());
            }
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private IncomeEntry createIncome(Investment inv, BigDecimal amount, LocalDate date,
                                     IncomeSource source, String description) {
        IncomeEntry entry = IncomeEntry.builder()
            .userId(inv.getUserId())
            .accountId(inv.getLinkedAccountId())
            .source(source)
            .paymentMode(IncomePaymentMode.BANK_ACCOUNT)
            .amount(amount)
            .description(description)
            .incomeDate(date)
            .periodMonth(date.getMonthValue())
            .periodYear(date.getYear())
            .build();
        return incomeRepository.save(entry);
    }

    private void saveIncomeLog(Investment inv, IncomeEntry income, String type,
                               LocalDate date, BigDecimal amount) {
        incomeLogRepository.save(InvestmentIncomeLog.builder()
            .investmentId(inv.getId())
            .userId(inv.getUserId())
            .incomeEntryId(income.getId())
            .incomeType(type)
            .eventDate(date)
            .amount(amount)
            .build());
    }

    private int paymentsPerYear(String freq) {
        return switch (freq.toUpperCase()) {
            case "MONTHLY"     -> 12;
            case "QUARTERLY"   -> 4;
            case "HALF_YEARLY" -> 2;
            default            -> 1;
        };
    }

    private List<LocalDate> generateCouponDates(LocalDate from, LocalDate to, String freq, Integer creditDay) {
        List<LocalDate> dates = new java.util.ArrayList<>();
        int months = switch (freq.toUpperCase()) {
            case "MONTHLY"     -> 1;
            case "QUARTERLY"   -> 3;
            case "HALF_YEARLY" -> 6;
            default            -> 12;
        };
        LocalDate cur = from.plusMonths(months);
        LocalDate end = to != null ? to : LocalDate.now();
        while (!cur.isAfter(end)) {
            // If a credit day is configured, pin the day-of-month to it (clamped to month length)
            LocalDate payDate = creditDay != null && creditDay >= 1
                ? cur.withDayOfMonth(Math.min(creditDay, cur.lengthOfMonth()))
                : cur;
            dates.add(payDate);
            cur = cur.plusMonths(months);
        }
        return dates;
    }

    /** Build the correct Yahoo Finance ticker: appends .BO for BSE investments, .NS for everything else. */
    private String yahooTicker(Investment inv) {
        String sym = inv.getSymbol();
        if (sym == null) return null;
        if (sym.endsWith(".NS") || sym.endsWith(".BO")) return sym;
        return "BSE".equals(inv.getExchange()) ? sym + ".BO" : sym + ".NS";
    }

    private BigDecimal calculateFDInterest(Investment fd) {
        BigDecimal principal = fd.getInvestedAmount();
        BigDecimal rate = fd.getCouponRate().divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);
        long days = java.time.temporal.ChronoUnit.DAYS.between(fd.getPurchaseDate(),
            fd.getMaturityDate() != null ? fd.getMaturityDate() : LocalDate.now());
        String compFreq = fd.getCompoundingFrequency() != null ? fd.getCompoundingFrequency() : "QUARTERLY";

        if ("SIMPLE".equalsIgnoreCase(compFreq)) {
            return principal.multiply(rate)
                .multiply(BigDecimal.valueOf(days)).divide(BigDecimal.valueOf(365), 2, RoundingMode.HALF_UP);
        }
        int n = paymentsPerYear(compFreq);
        double t = days / 365.0;
        double maturityAmount = principal.doubleValue() * Math.pow(1 + rate.doubleValue() / n, n * t);
        return BigDecimal.valueOf(maturityAmount - principal.doubleValue()).setScale(2, RoundingMode.HALF_UP);
    }
}
