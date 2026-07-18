package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.investment.repository.NseCorporateActionRepository;
import com.wealthynest.domain.investment.repository.StockPriceCacheRepository;
import com.wealthynest.infra.external.ExternalPriceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AutoIncomeSchedulerTest {

    @Mock private InvestmentRepository         investmentRepository;
    @Mock private NseCorporateActionRepository corporateActionRepository;
    @Mock private InvestmentIncomeLogRepository incomeLogRepository;
    @Mock private IncomeRepository             incomeRepository;
    @Mock private ExternalPriceService         externalPriceService;
    @Mock private StockPriceCacheRepository    stockPriceCacheRepository;
    @Mock private AutoIncomeScheduler          mockSelf;

    @InjectMocks
    private AutoIncomeScheduler scheduler;

    @BeforeEach
    void injectSelfProxy() {
        ReflectionTestUtils.setField(scheduler, "self", mockSelf);
        // Return a valid IncomeEntry from every save so saveIncomeLog can call income.getId()
        IncomeEntry savedIncome = new IncomeEntry();
        savedIncome.setId(UUID.randomUUID());
        lenient().when(incomeRepository.save(any())).thenReturn(savedIncome);
    }

    // ── Shared factory helpers ────────────────────────────────────────────────────

    private Investment buildStockInvestment(String symbol, LocalDate purchaseDate) {
        Investment inv = Investment.builder()
            .investmentType(InvestmentType.STOCK)
            .symbol(symbol)
            .purchaseDate(purchaseDate)
            .units(BigDecimal.TEN)
            .userId(UUID.randomUUID())
            .investedAmount(new BigDecimal("10000"))
            .currentValue(new BigDecimal("12000"))
            .build();
        ReflectionTestUtils.setField(inv, "id", UUID.randomUUID());
        return inv;
    }

    private Investment buildBond(BigDecimal couponRate, String couponFrequency,
                                  LocalDate purchaseDate, LocalDate maturityDate,
                                  BigDecimal avgBuyPrice, BigDecimal units, BigDecimal tdsRate) {
        Investment bond = Investment.builder()
            .investmentType(InvestmentType.BOND)
            .couponRate(couponRate)
            .couponFrequency(couponFrequency)
            .purchaseDate(purchaseDate)
            .maturityDate(maturityDate)
            .avgBuyPrice(avgBuyPrice)
            .units(units)
            .tdsRate(tdsRate != null ? tdsRate : BigDecimal.ZERO)
            .userId(UUID.randomUUID())
            .investedAmount(avgBuyPrice != null && units != null
                ? avgBuyPrice.multiply(units) : new BigDecimal("100000"))
            .currentValue(new BigDecimal("100000"))
            .companyName("Test Bond Ltd")
            .build();
        ReflectionTestUtils.setField(bond, "id", UUID.randomUUID());
        return bond;
    }

    private Investment buildFD(BigDecimal couponRate, LocalDate purchaseDate,
                                LocalDate maturityDate, BigDecimal principal, String compFreq) {
        Investment fd = Investment.builder()
            .investmentType(InvestmentType.FD)
            .couponRate(couponRate)
            .purchaseDate(purchaseDate)
            .maturityDate(maturityDate)
            .investedAmount(principal)
            .currentValue(principal)
            .compoundingFrequency(compFreq)
            .bankName("Test Bank")
            .userId(UUID.randomUUID())
            .build();
        ReflectionTestUtils.setField(fd, "id", UUID.randomUUID());
        return fd;
    }

    // ─── ProcessDividendsTests ────────────────────────────────────────────────────

    @Nested
    @DisplayName("processDividends (accessed via runAllAutoIncome)")
    class ProcessDividendsTests {

        @BeforeEach
        void stubBondFdAndFindAllToEmpty() {
            // Prevent bond/FD/price paths from calling mockSelf and interfering
            lenient().when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.BOND))
                .thenReturn(Collections.emptyList());
            lenient().when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.FD))
                .thenReturn(Collections.emptyList());
            lenient().when(investmentRepository.findAll())
                .thenReturn(Collections.emptyList());
        }

        @Test
        @DisplayName("no active STOCK investments → self never invoked")
        void noActiveStocks_noInteractionsWithSelf() {
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK))
                .thenReturn(Collections.emptyList());

            scheduler.runAllAutoIncome();

            verifyNoInteractions(mockSelf);
        }

        @Test
        @DisplayName("investment with null symbol is excluded before grouping")
        void investmentWithNoSymbol_excluded() {
            Investment inv = Investment.builder()
                .investmentType(InvestmentType.STOCK)
                .symbol(null)
                .purchaseDate(LocalDate.now())
                .investedAmount(BigDecimal.valueOf(1000))
                .currentValue(BigDecimal.valueOf(1000))
                .build();
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK))
                .thenReturn(List.of(inv));

            scheduler.runAllAutoIncome();

            verifyNoInteractions(mockSelf);
        }

        @Test
        @DisplayName("investment with null purchaseDate is excluded before grouping")
        void investmentWithNoPurchaseDate_excluded() {
            Investment inv = Investment.builder()
                .investmentType(InvestmentType.STOCK)
                .symbol("RELIANCE")
                .purchaseDate(null)
                .investedAmount(BigDecimal.valueOf(1000))
                .currentValue(BigDecimal.valueOf(1000))
                .build();
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK))
                .thenReturn(List.of(inv));

            scheduler.runAllAutoIncome();

            verifyNoInteractions(mockSelf);
        }

        @Test
        @DisplayName("two distinct symbols → self.processSymbolDividends called once per symbol with correct group")
        void twoSymbols_selfCalledTwiceWithCorrectGroupings() {
            // Production code sleeps 2 s between symbols — this test takes ~2 s
            Investment inv1 = buildStockInvestment("RELIANCE", LocalDate.now().minusYears(1));
            Investment inv2 = buildStockInvestment("TCS",      LocalDate.now().minusYears(1));
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK))
                .thenReturn(List.of(inv1, inv2));

            scheduler.runAllAutoIncome();

            verify(mockSelf).processSymbolDividends(eq("RELIANCE"), eq(List.of(inv1)));
            verify(mockSelf).processSymbolDividends(eq("TCS"),      eq(List.of(inv2)));
        }
    }

    // ─── ProcessSymbolDividendsTests ──────────────────────────────────────────────

    @Nested
    @DisplayName("processSymbolDividends")
    class ProcessSymbolDividendsTests {

        private final String symbol = "RELIANCE";
        private UUID         invId;
        private Investment   inv;

        @BeforeEach
        void setupRepresentativeInvestment() {
            invId = UUID.randomUUID();
            inv   = buildStockInvestment(symbol, LocalDate.now().minusYears(1));
            ReflectionTestUtils.setField(inv, "id", invId);
        }

        @Test
        @DisplayName("Yahoo throws RuntimeException → skips gracefully, no corp action or income saved")
        void yahooThrows_allInvestmentsSkipped() {
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenThrow(new RuntimeException("Yahoo unavailable"));

            scheduler.processSymbolDividends(symbol, List.of(inv));

            verifyNoInteractions(corporateActionRepository, incomeLogRepository);
            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("empty dividend history map → nothing credited")
        void emptyDividendHistory_nothingCredited() {
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Collections.emptyMap());

            scheduler.processSymbolDividends(symbol, List.of(inv));

            verifyNoInteractions(corporateActionRepository, incomeLogRepository);
            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("ex-date before investment purchaseDate → corp action saved (symbol-level), income NOT credited")
        void dividendBeforePurchaseDate_corpActionSaved_noIncomeCredited() {
            // Investment purchased 1 year ago; dividend 2 years ago (before purchase)
            LocalDate exDate = LocalDate.now().minusYears(2);
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Map.of(exDate.toString(), new BigDecimal("5.00")));
            when(corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate))
                .thenReturn(false);

            scheduler.processSymbolDividends(symbol, List.of(inv));

            // Corp action IS saved (outer loop has no purchaseDate guard)
            verify(corporateActionRepository).save(any(NseCorporateAction.class));
            // Income NOT credited because exDate < inv.purchaseDate
            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("ex-date in a prior month → corp action saved, income NOT credited (before monthStart)")
        void dividendBeforeCurrentMonth_corpActionSaved_noIncomeCredited() {
            LocalDate exDate = LocalDate.now().minusMonths(2).withDayOfMonth(5);
            Investment oldInv = buildStockInvestment(symbol, LocalDate.now().minusYears(3));
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Map.of(exDate.toString(), new BigDecimal("3.50")));
            when(corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate))
                .thenReturn(false);

            scheduler.processSymbolDividends(symbol, List.of(oldInv));

            verify(corporateActionRepository).save(any(NseCorporateAction.class));
            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("dividend already logged for this investment → income not credited again")
        void alreadyLoggedDividend_noIncomeCredited() {
            // withDayOfMonth(1) is always <= today and exactly == monthStart → never filtered by either guard
            LocalDate exDate = LocalDate.now().withDayOfMonth(1);
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Map.of(exDate.toString(), new BigDecimal("5.00")));
            when(corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate))
                .thenReturn(false);
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(invId, "DIVIDEND", exDate))
                .thenReturn(true);

            scheduler.processSymbolDividends(symbol, List.of(inv));

            verify(corporateActionRepository).save(any(NseCorporateAction.class));
            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("new dividend in current month → corp action and income both saved")
        void newDividendThisMonth_corpActionAndIncomeBothSaved() {
            // withDayOfMonth(1) = first of current month; always past/equal to today and == monthStart
            LocalDate exDate = LocalDate.now().withDayOfMonth(1);
            BigDecimal perShare = new BigDecimal("5.00");
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Map.of(exDate.toString(), perShare));
            when(corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate))
                .thenReturn(false);
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(invId, "DIVIDEND", exDate))
                .thenReturn(false);

            scheduler.processSymbolDividends(symbol, List.of(inv));

            verify(corporateActionRepository).save(any(NseCorporateAction.class));
            verify(incomeRepository).save(any(IncomeEntry.class));
            verify(incomeLogRepository).save(any(InvestmentIncomeLog.class));
        }

        @Test
        @DisplayName("two holders same symbol → corp action saved once, each holder credited once")
        void twoHoldersSameSymbol_eachCredited_corpActionSavedOnce() {
            UUID invId2   = UUID.randomUUID();
            Investment inv2 = buildStockInvestment(symbol, LocalDate.now().minusYears(1));
            ReflectionTestUtils.setField(inv2, "id", invId2);

            // withDayOfMonth(1) = first of current month; always past/equal to today and == monthStart
            LocalDate exDate = LocalDate.now().withDayOfMonth(1);
            when(externalPriceService.fetchDividendHistory(anyString(), anyLong()))
                .thenReturn(Map.of(exDate.toString(), new BigDecimal("5.00")));
            when(corporateActionRepository.existsBySymbolAndActionTypeAndExDate(symbol, "DIVIDEND", exDate))
                .thenReturn(false);
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(invId,  "DIVIDEND", exDate))
                .thenReturn(false);
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(invId2, "DIVIDEND", exDate))
                .thenReturn(false);

            scheduler.processSymbolDividends(symbol, List.of(inv, inv2));

            verify(corporateActionRepository, times(1)).save(any(NseCorporateAction.class));
            verify(incomeRepository, times(2)).save(any(IncomeEntry.class));
            verify(incomeLogRepository, times(2)).save(any(InvestmentIncomeLog.class));
        }
    }

    // ─── ProcessSingleBondCouponsTests ────────────────────────────────────────────

    @Nested
    @DisplayName("processSingleBondCoupons")
    class ProcessSingleBondCouponsTests {

        @Test
        @DisplayName("first coupon date is in the future → skipped, nothing saved")
        void futureCouponDate_skipped() {
            // Annual bond purchased today → first coupon = 1 year from now (future)
            Investment bond = buildBond(
                new BigDecimal("10"), "ANNUALLY",
                LocalDate.now(), LocalDate.now().plusYears(5),
                new BigDecimal("1000"), BigDecimal.valueOf(100), BigDecimal.ZERO);

            scheduler.processSingleBondCoupons(bond);

            verify(incomeRepository, never()).save(any());
            verify(incomeLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("coupon date falls before current month start → skipped (no historical backfill)")
        void couponBeforeMonthStart_skipped() {
            // Quarterly bond purchased 4 months ago → first coupon = 3 months ago (before monthStart)
            LocalDate purchaseDate = LocalDate.now().minusMonths(4).withDayOfMonth(1);
            Investment bond = buildBond(
                new BigDecimal("8"), "QUARTERLY",
                purchaseDate, LocalDate.now().plusYears(2),
                new BigDecimal("1000"), BigDecimal.valueOf(100), BigDecimal.ZERO);

            scheduler.processSingleBondCoupons(bond);

            verify(incomeRepository, never()).save(any());
            verify(incomeLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("coupon already logged for this investment → not credited again")
        void alreadyLoggedCoupon_skipped() {
            LocalDate purchaseDate    = LocalDate.now().minusYears(1).withDayOfMonth(1);
            LocalDate expectedCoupon  = purchaseDate.plusYears(1); // = this month's 1st
            Investment bond = buildBond(
                new BigDecimal("12"), "ANNUALLY",
                purchaseDate, LocalDate.now().plusYears(5),
                new BigDecimal("1000"), BigDecimal.valueOf(100), BigDecimal.ZERO);
            UUID bondId = (UUID) ReflectionTestUtils.getField(bond, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                bondId, "BOND_COUPON", expectedCoupon)).thenReturn(true);

            scheduler.processSingleBondCoupons(bond);

            verify(incomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("annual coupon due this month → income and log both saved with correct gross amount")
        void happyPath_annualFrequency_couponCredited() {
            // face value = 1000 * 100 = 100 000; 12% annual → gross = 12 000
            LocalDate purchaseDate   = LocalDate.now().minusYears(1).withDayOfMonth(1);
            LocalDate expectedCoupon = purchaseDate.plusYears(1);
            Investment bond = buildBond(
                new BigDecimal("12"), "ANNUALLY",
                purchaseDate, LocalDate.now().plusYears(5),
                new BigDecimal("1000"), BigDecimal.valueOf(100), BigDecimal.ZERO);
            UUID bondId = (UUID) ReflectionTestUtils.getField(bond, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                bondId, "BOND_COUPON", expectedCoupon)).thenReturn(false);

            scheduler.processSingleBondCoupons(bond);

            ArgumentCaptor<IncomeEntry> incomeCaptor = ArgumentCaptor.forClass(IncomeEntry.class);
            verify(incomeRepository).save(incomeCaptor.capture());
            assertThat(incomeCaptor.getValue().getAmount()).isEqualByComparingTo(new BigDecimal("12000.00"));
            verify(incomeLogRepository).save(any(InvestmentIncomeLog.class));
        }

        @Test
        @DisplayName("annual coupon with 10% TDS → net coupon = gross × 0.90")
        void withTdsRate_netCouponDeducted() {
            // gross = 100 000 * 12% / 1 = 12 000; net = 12 000 * 0.90 = 10 800
            LocalDate purchaseDate   = LocalDate.now().minusYears(1).withDayOfMonth(1);
            LocalDate expectedCoupon = purchaseDate.plusYears(1);
            Investment bond = buildBond(
                new BigDecimal("12"), "ANNUALLY",
                purchaseDate, LocalDate.now().plusYears(5),
                new BigDecimal("1000"), BigDecimal.valueOf(100),
                new BigDecimal("10")); // 10% TDS
            UUID bondId = (UUID) ReflectionTestUtils.getField(bond, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                bondId, "BOND_COUPON", expectedCoupon)).thenReturn(false);

            scheduler.processSingleBondCoupons(bond);

            ArgumentCaptor<IncomeEntry> captor = ArgumentCaptor.forClass(IncomeEntry.class);
            verify(incomeRepository).save(captor.capture());
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo(new BigDecimal("10800.00"));
        }
    }

    // ─── ProcessSingleFdTests ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("processSingleFD")
    class ProcessSingleFdTests {

        @Test
        @DisplayName("maturity date is in the future → returns immediately, nothing saved")
        void futureMaturityDate_skipped() {
            Investment fd = buildFD(new BigDecimal("7"),
                LocalDate.now().minusYears(1), LocalDate.now().plusDays(30),
                new BigDecimal("100000"), "SIMPLE");

            scheduler.processSingleFD(fd);

            verifyNoInteractions(incomeLogRepository, incomeRepository);
            verify(investmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("maturity already logged → not credited again and FD not touched")
        void alreadyLoggedMaturity_skipped() {
            LocalDate maturity = LocalDate.now().minusDays(1);
            Investment fd = buildFD(new BigDecimal("7"),
                LocalDate.now().minusYears(1), maturity,
                new BigDecimal("100000"), "SIMPLE");
            UUID fdId = (UUID) ReflectionTestUtils.getField(fd, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                fdId, "FD_MATURITY", maturity)).thenReturn(true);

            scheduler.processSingleFD(fd);

            verify(incomeRepository, never()).save(any());
            verify(investmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("simple interest FD matured → interest credited and FD set inactive")
        void simpleInterest_matured_creditedAndDeactivated() {
            LocalDate purchaseDate = LocalDate.now().minusDays(365);
            LocalDate maturityDate = LocalDate.now().minusDays(1);
            BigDecimal principal   = new BigDecimal("100000");
            Investment fd = buildFD(new BigDecimal("7"), purchaseDate, maturityDate, principal, "SIMPLE");
            UUID fdId = (UUID) ReflectionTestUtils.getField(fd, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                fdId, "FD_MATURITY", maturityDate)).thenReturn(false);

            scheduler.processSingleFD(fd);

            // Simple interest = 100 000 × 7% × 364 / 365 ≈ positive
            ArgumentCaptor<IncomeEntry> incomeCaptor = ArgumentCaptor.forClass(IncomeEntry.class);
            verify(incomeRepository).save(incomeCaptor.capture());
            assertThat(incomeCaptor.getValue().getAmount()).isPositive();

            // FD must be deactivated and persisted
            ArgumentCaptor<Investment> fdCaptor = ArgumentCaptor.forClass(Investment.class);
            verify(investmentRepository).save(fdCaptor.capture());
            assertThat(fdCaptor.getValue().isActive()).isFalse();
        }

        @Test
        @DisplayName("quarterly compounding FD matured → compound interest credited and FD set inactive")
        void compoundInterest_quarterly_creditedAndDeactivated() {
            LocalDate purchaseDate = LocalDate.now().minusYears(2);
            LocalDate maturityDate = LocalDate.now().minusDays(1);
            BigDecimal principal   = new BigDecimal("50000");
            Investment fd = buildFD(new BigDecimal("8"), purchaseDate, maturityDate, principal, "QUARTERLY");
            UUID fdId = (UUID) ReflectionTestUtils.getField(fd, "id");

            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                fdId, "FD_MATURITY", maturityDate)).thenReturn(false);

            scheduler.processSingleFD(fd);

            verify(incomeRepository).save(any(IncomeEntry.class));
            ArgumentCaptor<Investment> fdCaptor = ArgumentCaptor.forClass(Investment.class);
            verify(investmentRepository).save(fdCaptor.capture());
            assertThat(fdCaptor.getValue().isActive()).isFalse();
        }
    }

    // ─── SeedMissingStockPricesTests ──────────────────────────────────────────────

    @Nested
    @DisplayName("seedMissingStockPrices")
    class SeedMissingStockPricesTests {

        @Test
        @DisplayName("no investments in repository → no Yahoo calls")
        void noActiveStocks_noYahooCalls() {
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(Collections.emptyList());

            scheduler.seedMissingStockPrices();

            verifyNoInteractions(externalPriceService, stockPriceCacheRepository);
        }

        @Test
        @DisplayName("Yahoo returns null price → bulk update skipped, no exception")
        void yahooReturnsNull_warnsAndContinues() {
            Investment inv = buildStockInvestment("RELIANCE", LocalDate.now().minusYears(1));
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(List.of(inv));
            when(externalPriceService.fetchStockPrice(anyString())).thenReturn(null);

            scheduler.seedMissingStockPrices();

            verify(investmentRepository, never()).bulkUpdatePriceBySymbol(anyString(), any());
        }

        @Test
        @DisplayName("single symbol → cache created (or updated) and bulk update called")
        void singleSymbol_cacheCreatedAndBulkUpdateCalled() {
            Investment inv = buildStockInvestment("RELIANCE", LocalDate.now().minusYears(1));
            BigDecimal price = new BigDecimal("2500.00");
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(List.of(inv));
            when(externalPriceService.fetchStockPrice("RELIANCE.NS")).thenReturn(price);
            when(stockPriceCacheRepository.findById("RELIANCE")).thenReturn(Optional.empty());
            when(stockPriceCacheRepository.save(any())).thenReturn(new StockPriceCache());
            when(investmentRepository.bulkUpdatePriceBySymbol("RELIANCE", price)).thenReturn(1);

            scheduler.seedMissingStockPrices();

            verify(stockPriceCacheRepository).save(any(StockPriceCache.class));
            verify(investmentRepository).bulkUpdatePriceBySymbol("RELIANCE", price);
        }

        @Test
        @DisplayName("two investments with same symbol → only one Yahoo call (deduplication)")
        void multipleInvestmentsSameSymbol_onlyOneYahooCall() {
            Investment inv1 = buildStockInvestment("TCS", LocalDate.now().minusYears(1));
            Investment inv2 = buildStockInvestment("TCS", LocalDate.now().minusMonths(6));
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(List.of(inv1, inv2));
            when(externalPriceService.fetchStockPrice("TCS.NS")).thenReturn(new BigDecimal("3700"));
            when(stockPriceCacheRepository.findById("TCS")).thenReturn(Optional.empty());
            when(stockPriceCacheRepository.save(any())).thenReturn(new StockPriceCache());
            when(investmentRepository.bulkUpdatePriceBySymbol(eq("TCS"), any())).thenReturn(2);

            scheduler.seedMissingStockPrices();

            verify(externalPriceService, times(1)).fetchStockPrice("TCS.NS");
        }

        @Test
        @DisplayName("existing cache entry → previousClose and dayChange populated on save")
        void existingCache_dayChangesPopulated() {
            Investment inv    = buildStockInvestment("INFY", LocalDate.now().minusYears(1));
            BigDecimal prev   = new BigDecimal("1800");
            BigDecimal newPx  = new BigDecimal("1900");
            StockPriceCache existingCache = StockPriceCache.builder()
                .symbol("INFY").exchange("NSE").currentPrice(prev).build();

            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(List.of(inv));
            when(externalPriceService.fetchStockPrice("INFY.NS")).thenReturn(newPx);
            when(stockPriceCacheRepository.findById("INFY")).thenReturn(Optional.of(existingCache));
            when(stockPriceCacheRepository.save(any())).thenReturn(existingCache);
            lenient().when(investmentRepository.bulkUpdatePriceBySymbol(eq("INFY"), any())).thenReturn(1);

            scheduler.seedMissingStockPrices();

            ArgumentCaptor<StockPriceCache> captor = ArgumentCaptor.forClass(StockPriceCache.class);
            verify(stockPriceCacheRepository).save(captor.capture());
            assertThat(captor.getValue().getPreviousClose()).isEqualByComparingTo(prev);
            assertThat(captor.getValue().getDayChange()).isEqualByComparingTo(new BigDecimal("100"));
        }

        @Test
        @DisplayName("two distinct symbols → two Yahoo calls and two bulk updates")
        void twoDistinctSymbols_twoBulkUpdates() {
            // Production code sleeps 1 s between symbols — this test takes ~1 s
            Investment inv1 = buildStockInvestment("RELIANCE", LocalDate.now().minusYears(1));
            Investment inv2 = buildStockInvestment("TCS",      LocalDate.now().minusYears(1));
            when(investmentRepository.findByInvestmentTypeAndActiveTrue(InvestmentType.STOCK)).thenReturn(List.of(inv1, inv2));
            when(externalPriceService.fetchStockPrice("RELIANCE.NS")).thenReturn(new BigDecimal("2500"));
            when(externalPriceService.fetchStockPrice("TCS.NS")).thenReturn(new BigDecimal("3700"));
            when(stockPriceCacheRepository.findById(anyString())).thenReturn(Optional.empty());
            when(stockPriceCacheRepository.save(any())).thenReturn(new StockPriceCache());
            lenient().when(investmentRepository.bulkUpdatePriceBySymbol(anyString(), any())).thenReturn(1);

            scheduler.seedMissingStockPrices();

            verify(investmentRepository).bulkUpdatePriceBySymbol(eq("RELIANCE"), any());
            verify(investmentRepository).bulkUpdatePriceBySymbol(eq("TCS"),      any());
        }
    }
}
