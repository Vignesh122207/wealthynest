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
        List<Investment> stocks = investmentRepository.findAll().stream()
            .filter(i -> i.isActive() && i.getInvestmentType() == InvestmentType.STOCK
                && i.getSymbol() != null && i.getPurchaseDate() != null)
            .toList();
        for (int i = 0; i < stocks.size(); i++) {
            // 2-second gap between stocks to stay well within Yahoo's rate limits
            if (i > 0) {
                try { Thread.sleep(2000); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); return;
                }
            }
            self.processSingleStockDividends(stocks.get(i));
        }
    }

    @Transactional
    public void processSingleStockDividends(Investment inv) {
        long fromEpoch = inv.getPurchaseDate().atStartOfDay()
            .toInstant(java.time.ZoneOffset.UTC).getEpochSecond();
        Map<String, BigDecimal> divHistory;
        try {
            divHistory = externalPriceService.fetchDividendHistory(inv.getSymbol(), fromEpoch);
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

        // Get cached price or fetch fresh from Yahoo; always update this investment's currentValue
        BigDecimal cachedPrice = stockPriceCacheRepository.findById(inv.getSymbol())
            .map(StockPriceCache::getCurrentPrice).orElse(null);
        if (cachedPrice == null) {
            BigDecimal fetchedPrice = externalPriceService.fetchStockPrice(inv.getSymbol());
            if (fetchedPrice != null) {
                stockPriceCacheRepository.save(StockPriceCache.builder()
                    .symbol(inv.getSymbol()).exchange("NSE")
                    .currentPrice(fetchedPrice).lastUpdated(Instant.now()).build());
                cachedPrice = fetchedPrice;
            }
        }
        if (cachedPrice != null) {
            final BigDecimal finalPrice = cachedPrice;
            investmentRepository.findById(inv.getId()).ifPresent(i -> {
                i.setCurrentPrice(finalPrice);
                if (i.getUnits() != null)
                    i.setCurrentValue(i.getUnits().multiply(finalPrice));
                investmentRepository.save(i);
            });
            log.info("Current value set to ₹{}/share × {} units for {} ({})",
                cachedPrice, inv.getUnits(), inv.getSymbol(), inv.getId());
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
            divHistory = externalPriceService.fetchDividendHistory(inv.getSymbol(), fromEpoch);
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
        investmentRepository.findAll().stream()
            .filter(i -> i.isActive() && i.getInvestmentType() == InvestmentType.BOND
                && i.getCouponRate() != null && i.getCouponFrequency() != null
                && i.getPurchaseDate() != null)
            .forEach(b -> self.processSingleBondCoupons(b));
    }

    @Transactional
    public void processSingleBondCoupons(Investment bond) {
        try {
            int paymentsPerYear = paymentsPerYear(bond.getCouponFrequency());
            // investedAmount is already total face value (faceValuePerBond × quantity)
            BigDecimal couponAmt = bond.getInvestedAmount()
                .multiply(bond.getCouponRate())
                .divide(BigDecimal.valueOf(100L * paymentsPerYear), 2, RoundingMode.HALF_UP);

            LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
            for (LocalDate cpDate : generateCouponDates(
                    bond.getPurchaseDate(), bond.getMaturityDate(), bond.getCouponFrequency())) {
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
        investmentRepository.findAll().stream()
            .filter(i -> i.isActive() && i.getInvestmentType() == InvestmentType.FD
                && i.getCouponRate() != null && i.getPurchaseDate() != null)
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
        List<Investment> missing = investmentRepository.findAll().stream()
            .filter(i -> i.isActive() && i.getInvestmentType() == InvestmentType.STOCK
                && i.getSymbol() != null
                && !stockPriceCacheRepository.existsById(i.getSymbol()))
            .toList();
        if (missing.isEmpty()) return;
        log.info("Seeding live prices for {} stocks without cache", missing.size());
        for (int i = 0; i < missing.size(); i++) {
            if (i > 0) {
                try { Thread.sleep(1000); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt(); return;
                }
            }
            Investment inv = missing.get(i);
            try {
                BigDecimal price = externalPriceService.fetchStockPrice(inv.getSymbol());
                if (price != null) {
                    stockPriceCacheRepository.save(StockPriceCache.builder()
                        .symbol(inv.getSymbol()).exchange("NSE")
                        .currentPrice(price).lastUpdated(Instant.now()).build());
                    // update all active investments holding this symbol
                    investmentRepository.findAll().stream()
                        .filter(x -> x.isActive() && inv.getSymbol().equals(x.getSymbol()) && x.getUnits() != null)
                        .forEach(x -> {
                            x.setCurrentPrice(price);
                            x.setCurrentValue(x.getUnits().multiply(price));
                            investmentRepository.save(x);
                        });
                    log.info("Seeded ₹{} for {}", price, inv.getSymbol());
                }
            } catch (Exception e) {
                log.warn("Price seed failed for {}: {}", inv.getSymbol(), e.getMessage());
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

    private List<LocalDate> generateCouponDates(LocalDate from, LocalDate to, String freq) {
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
            dates.add(cur);
            cur = cur.plusMonths(months);
        }
        return dates;
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
