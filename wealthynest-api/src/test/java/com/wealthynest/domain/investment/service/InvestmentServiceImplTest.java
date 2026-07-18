package com.wealthynest.domain.investment.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.request.CreateStockTransactionRequest;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.dto.response.SipTransactionResponse;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.entity.SipTransaction;
import com.wealthynest.domain.investment.entity.StockTransaction;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvestmentServiceImplTest {

    @Mock private InvestmentRepository          investmentRepository;
    @Mock private AssetRepository               assetRepository;
    @Mock private StockPriceCacheRepository     stockPriceCacheRepository;
    @Mock private GoldPriceCacheRepository      goldPriceCacheRepository;
    @Mock private MFNavCacheRepository          mfNavCacheRepository;
    @Mock private StockMasterRepository         stockMasterRepository;
    @Mock private MfMasterRepository            mfMasterRepository;
    @Mock private SipTransactionRepository      sipTransactionRepository;
    @Mock private NseCorporateActionRepository  corpActionRepository;
    @Mock private InvestmentIncomeLogRepository incomeLogRepository;
    @Mock private WalletAccountRepository       accountRepository;
    @Mock private AccountOwnershipGuard         accountOwnershipGuard;
    @Mock private AccountTransferRepository     accountTransferRepository;
    @Mock private IncomeRepository              incomeRepository;
    @Mock private ExternalPriceService          externalPriceService;
    @Mock private AutoIncomeScheduler           autoIncomeScheduler;
    @Mock private DismissedDividendRepository   dismissedDividendRepository;
    @Mock private StockTransactionRepository    stockTransactionRepository;

    @InjectMocks
    private InvestmentServiceImpl service;

    private final UUID userId       = UUID.randomUUID();
    private final UUID investmentId = UUID.randomUUID();

    // ── Shared factory helpers ────────────────────────────────────────────────────

    private Investment.InvestmentBuilder baseInvestment() {
        return Investment.builder()
                .userId(userId).assetId(UUID.randomUUID())
                .investedAmount(new BigDecimal("100000"))
                .currentValue(new BigDecimal("100000"))
                .active(true);
    }

    private Investment withId(Investment inv) {
        ReflectionTestUtils.setField(inv, "id", investmentId);
        return inv;
    }

    private CreateInvestmentRequest mockRequest() {
        CreateInvestmentRequest req = mock(CreateInvestmentRequest.class);
        lenient().when(req.getInvestmentType()).thenReturn(InvestmentType.FD);
        lenient().when(req.getInvestedAmount()).thenReturn(new BigDecimal("100000"));
        lenient().when(req.getCurrentValue()).thenReturn(new BigDecimal("100000"));
        lenient().when(req.getExchange()).thenReturn(null);
        lenient().when(req.getTdsRate()).thenReturn(null);
        lenient().when(req.getBrokerage()).thenReturn(null);
        lenient().when(req.getGoldKarat()).thenReturn(null);
        return req;
    }

    // ─── FD maturity / accrued interest (via getInvestments -> enrich) ─────────────

    @Nested
    @DisplayName("FD maturity & accrued interest")
    class FdCalculationTests {

        @Test
        @DisplayName("SIMPLE interest FD: 10% for exactly 365 days on 100000 -> 110000.00 maturity")
        void simpleInterestMaturity() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("10"))
                    .compoundingFrequency("SIMPLE")
                    .purchaseDate(LocalDate.of(2023, 1, 1))
                    .maturityDate(LocalDate.of(2024, 1, 1)) // 365 days, non-leap
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getMaturityAmount()).isEqualByComparingTo("110000.00");
        }

        @Test
        @DisplayName("QUARTERLY compounding FD: 8% compounded quarterly over 365 days -> 108243.22")
        void quarterlyCompoundingMaturity() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .compoundingFrequency("QUARTERLY")
                    .purchaseDate(LocalDate.of(2023, 1, 1))
                    .maturityDate(LocalDate.of(2024, 1, 1))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getMaturityAmount()).isEqualByComparingTo("108243.22");
        }

        @Test
        @DisplayName("null compoundingFrequency defaults to QUARTERLY, matching an explicit QUARTERLY FD")
        void defaultsToQuarterlyWhenFrequencyOmitted() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .compoundingFrequency(null)
                    .purchaseDate(LocalDate.of(2023, 1, 1))
                    .maturityDate(LocalDate.of(2024, 1, 1))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getMaturityAmount()).isEqualByComparingTo("108243.22");
        }

        @Test
        @DisplayName("HALF_YEARLY and MONTHLY compounding both terminate and produce a positive maturity above principal")
        void otherCompoundingFrequenciesResolve() {
            for (String freq : List.of("HALF_YEARLY", "MONTHLY", "ANNUALLY")) {
                Investment fd = withId(baseInvestment()
                        .investmentType(InvestmentType.FD)
                        .investedAmount(new BigDecimal("100000"))
                        .couponRate(new BigDecimal("8"))
                        .compoundingFrequency(freq)
                        .purchaseDate(LocalDate.of(2023, 1, 1))
                        .maturityDate(LocalDate.of(2024, 1, 1))
                        .build());
                when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

                InvestmentResponse response = service.getInvestments(userId).get(0);

                assertThat(response.getMaturityAmount()).isGreaterThan(new BigDecimal("100000"));
            }
        }

        @Test
        @DisplayName("missing maturityDate yields null maturityAmount and null accruedInterest, no exception")
        void missingMaturityDateYieldsNulls() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .couponRate(new BigDecimal("8"))
                    .purchaseDate(LocalDate.now().minusDays(30))
                    .maturityDate(null)
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getMaturityAmount()).isNull();
            assertThat(response.getAccruedInterest()).isNull();
        }

        @Test
        @DisplayName("null couponRate skips FD enrichment entirely -> currentValue stays as stored")
        void nullCouponRateSkipsEnrichment() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("100000"))
                    .currentValue(new BigDecimal("100000"))
                    .couponRate(null)
                    .purchaseDate(LocalDate.now().minusDays(30))
                    .maturityDate(LocalDate.now().plusYears(1))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getMaturityAmount()).isNull();
            assertThat(response.getAccruedInterest()).isNull();
            assertThat(response.getCurrentValue()).isEqualByComparingTo("100000");
        }

        @Test
        @DisplayName("accrued interest as of today equals the maturity value computed only up to today, minus principal")
        void accruedInterestMatchesPartialPeriodMaturity() {
            Investment fd = withId(baseInvestment()
                    .investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .compoundingFrequency("QUARTERLY")
                    .purchaseDate(LocalDate.now().minusDays(365))
                    .maturityDate(LocalDate.now().plusYears(5)) // far future -> accrual capped at "today"
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getAccruedInterest()).isEqualByComparingTo("8243.22");
            // currentValue is overlaid with invested + accrued for FDs
            assertThat(response.getCurrentValue()).isEqualByComparingTo("108243.22");
        }
    }

    // ─── Bond accrued coupon (via getInvestments -> enrich) ────────────────────────

    @Nested
    @DisplayName("Bond accrued coupon")
    class BondCalculationTests {

        @Test
        @DisplayName("gross accrued coupon on face value x units over exactly 365 days, no TDS")
        void grossAccruedNoTds() {
            Investment bond = withId(baseInvestment()
                    .investmentType(InvestmentType.BOND)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .faceValue(new BigDecimal("1000"))
                    .units(new BigDecimal("100"))
                    .tdsRate(BigDecimal.ZERO)
                    .purchaseDate(LocalDate.now().minusDays(365))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(bond));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getAccruedInterest()).isEqualByComparingTo("8000.00");
        }

        @Test
        @DisplayName("TDS is deducted from the gross accrued coupon")
        void netAccruedWithTds() {
            Investment bond = withId(baseInvestment()
                    .investmentType(InvestmentType.BOND)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .faceValue(new BigDecimal("1000"))
                    .units(new BigDecimal("100"))
                    .tdsRate(new BigDecimal("10"))
                    .purchaseDate(LocalDate.now().minusDays(365))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(bond));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getAccruedInterest()).isEqualByComparingTo("7200.00");
        }

        @Test
        @DisplayName("falls back to avgBuyPrice as face value when faceValue is not set")
        void fallsBackToAvgBuyPriceWhenNoFaceValue() {
            Investment bond = withId(baseInvestment()
                    .investmentType(InvestmentType.BOND)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .faceValue(null)
                    .avgBuyPrice(new BigDecimal("1000"))
                    .units(new BigDecimal("100"))
                    .tdsRate(BigDecimal.ZERO)
                    .purchaseDate(LocalDate.now().minusDays(365))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(bond));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getAccruedInterest()).isEqualByComparingTo("8000.00");
        }

        @Test
        @DisplayName("accrual is capped at maturityDate, not extended to today, once the bond has matured")
        void accrualCappedAtMaturityDate() {
            Investment bond = withId(baseInvestment()
                    .investmentType(InvestmentType.BOND)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .faceValue(new BigDecimal("1000"))
                    .units(new BigDecimal("100"))
                    .tdsRate(BigDecimal.ZERO)
                    .purchaseDate(LocalDate.now().minusDays(730))
                    .maturityDate(LocalDate.now().minusDays(365)) // matured 365 days ago
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(bond));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            // Accrual window is purchaseDate -> maturityDate (365 days), not purchaseDate -> today (730 days)
            assertThat(response.getAccruedInterest()).isEqualByComparingTo("8000.00");
        }

        @Test
        @DisplayName("zero elapsed days (purchased today) yields zero accrued coupon, not a negative or divide error")
        void zeroDaysYieldsZeroAccrued() {
            Investment bond = withId(baseInvestment()
                    .investmentType(InvestmentType.BOND)
                    .investedAmount(new BigDecimal("100000"))
                    .couponRate(new BigDecimal("8"))
                    .faceValue(new BigDecimal("1000"))
                    .units(new BigDecimal("100"))
                    .purchaseDate(LocalDate.now())
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(bond));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getAccruedInterest()).isEqualByComparingTo("0");
        }
    }

    // ─── Gain / loss percentage (via getInvestments -> enrich) ─────────────────────

    @Nested
    @DisplayName("Gain/loss percentage")
    class GainLossTests {

        @Test
        @DisplayName("positive gain: 125000 current vs 100000 invested -> +25000 / +25.0%")
        void positiveGain() {
            Investment inv = withId(baseInvestment()
                    .investmentType(InvestmentType.PPF)
                    .investedAmount(new BigDecimal("100000"))
                    .currentValue(new BigDecimal("125000"))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getGainLoss()).isEqualByComparingTo("25000");
            assertThat(response.getGainLossPct()).isEqualTo(25.0);
        }

        @Test
        @DisplayName("loss: 80000 current vs 100000 invested -> -20000 / -20.0%")
        void negativeLoss() {
            Investment inv = withId(baseInvestment()
                    .investmentType(InvestmentType.PPF)
                    .investedAmount(new BigDecimal("100000"))
                    .currentValue(new BigDecimal("80000"))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getGainLoss()).isEqualByComparingTo("-20000");
            assertThat(response.getGainLossPct()).isEqualTo(-20.0);
        }

        @Test
        @DisplayName("zero invested amount guards against divide-by-zero, yielding 0.0%")
        void zeroInvestedGuardsDivideByZero() {
            Investment inv = withId(baseInvestment()
                    .investmentType(InvestmentType.PPF)
                    .investedAmount(BigDecimal.ZERO)
                    .currentValue(new BigDecimal("500"))
                    .build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getGainLossPct()).isEqualTo(0.0);
            assertThat(response.getGainLoss()).isEqualByComparingTo("500");
        }
    }

    // ─── XIRR ────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("computeXirr")
    class ComputeXirrTests {

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown investment")
        void throwsWhenNotFound() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.computeXirr(investmentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException when the investment belongs to another user")
        void throwsWhenNotOwned() {
            Investment inv = withId(baseInvestment().userId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> service.computeXirr(investmentId, userId))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("null currentValue returns null without attempting a calculation")
        void nullCurrentValueReturnsNull() {
            Investment inv = withId(baseInvestment().currentValue(null).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));

            assertThat(service.computeXirr(investmentId, userId)).isNull();
        }

        @Test
        @DisplayName("zero currentValue returns null")
        void zeroCurrentValueReturnsNull() {
            Investment inv = withId(baseInvestment().currentValue(BigDecimal.ZERO).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));

            assertThat(service.computeXirr(investmentId, userId)).isNull();
        }

        @Test
        @DisplayName("no ledger: falls back to a single outflow on purchaseDate -> 10% over exactly 365 days")
        void fallsBackToPurchaseDateSingleOutflow() {
            Investment inv = withId(baseInvestment()
                    .investedAmount(new BigDecimal("100000"))
                    .currentValue(new BigDecimal("110000"))
                    .purchaseDate(LocalDate.now().minusDays(365))
                    .build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(sipTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of());
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of());

            Double xirr = service.computeXirr(investmentId, userId);

            assertThat(xirr).isCloseTo(10.0, within(0.01));
        }

        @Test
        @DisplayName("uses the stock-transaction ledger instead of the fallback when buy lots are recorded")
        void usesStockLedgerWhenPresent() {
            // investedAmount/purchaseDate are deliberately "wrong" so a pass would only be possible
            // via the ledger, proving the fallback path is NOT taken once transactions exist.
            Investment inv = withId(baseInvestment()
                    .investedAmount(new BigDecimal("999999"))
                    .currentValue(new BigDecimal("110000"))
                    .purchaseDate(LocalDate.now().minusDays(9999))
                    .build());
            StockTransaction buy = StockTransaction.builder()
                    .investmentId(investmentId)
                    .transactionDate(LocalDate.now().minusDays(365))
                    .transactionType("BUY")
                    .quantity(new BigDecimal("100"))
                    .pricePerShare(new BigDecimal("1000"))
                    .brokerage(BigDecimal.ZERO)
                    .build();
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(sipTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of());
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of(buy));

            Double xirr = service.computeXirr(investmentId, userId);

            assertThat(xirr).isCloseTo(10.0, within(0.01));
        }

        @Test
        @DisplayName("uses the SIP-transaction ledger instead of the fallback when SIP buys are recorded")
        void usesSipLedgerWhenPresent() {
            Investment inv = withId(baseInvestment()
                    .investedAmount(new BigDecimal("999999"))
                    .currentValue(new BigDecimal("110000"))
                    .purchaseDate(LocalDate.now().minusDays(9999))
                    .build());
            SipTransaction buy = SipTransaction.builder()
                    .investmentId(investmentId)
                    .transactionDate(LocalDate.now().minusDays(365))
                    .amount(new BigDecimal("100000"))
                    .transactionType("BUY")
                    .build();
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(sipTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of(buy));
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)).thenReturn(List.of());

            Double xirr = service.computeXirr(investmentId, userId);

            assertThat(xirr).isCloseTo(10.0, within(0.01));
        }
    }

    @Nested
    @DisplayName("computePortfolioXirr / computeTypeXirr")
    class PortfolioXirrTests {

        @Test
        @DisplayName("returns null when the user has no active investments")
        void nullWhenNoInvestments() {
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of());

            assertThat(service.computePortfolioXirr(userId)).isNull();
        }

        @Test
        @DisplayName("aggregates every active investment's cashflows onto one timeline")
        void aggregatesAcrossInvestments() {
            Investment inv1 = withId(baseInvestment()
                    .investedAmount(new BigDecimal("100000")).currentValue(new BigDecimal("110000"))
                    .purchaseDate(LocalDate.now().minusDays(365)).build());
            Investment inv2 = baseInvestment()
                    .investedAmount(new BigDecimal("50000")).currentValue(new BigDecimal("55000"))
                    .purchaseDate(LocalDate.now().minusDays(365)).build();
            ReflectionTestUtils.setField(inv2, "id", UUID.randomUUID());

            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv1, inv2));
            when(sipTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(any())).thenReturn(List.of());
            when(stockTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(any())).thenReturn(List.of());

            Double xirr = service.computePortfolioXirr(userId);

            // Both legs return exactly 10% over the same 365-day window -> combined return is 10%.
            assertThat(xirr).isCloseTo(10.0, within(0.01));
        }

        @Test
        @DisplayName("computeTypeXirr only aggregates investments matching the requested type")
        void filtersByType() {
            Investment stock = withId(baseInvestment()
                    .investmentType(InvestmentType.STOCK)
                    .investedAmount(new BigDecimal("100000")).currentValue(new BigDecimal("110000"))
                    .purchaseDate(LocalDate.now().minusDays(365)).build());
            Investment fd = baseInvestment()
                    .investmentType(InvestmentType.FD)
                    // Wildly different return so an accidental inclusion would fail the assertion below.
                    .investedAmount(new BigDecimal("100000")).currentValue(new BigDecimal("500000"))
                    .purchaseDate(LocalDate.now().minusDays(365)).build();
            ReflectionTestUtils.setField(fd, "id", UUID.randomUUID());

            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(stock, fd));
            when(sipTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(any())).thenReturn(List.of());
            when(stockTransactionRepository.findByInvestmentIdInOrderByTransactionDateAsc(any())).thenReturn(List.of());

            Double xirr = service.computeTypeXirr(userId, InvestmentType.STOCK);

            assertThat(xirr).isCloseTo(10.0, within(0.01));
        }
    }

    // ─── createInvestment ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createInvestment")
    class CreateInvestmentTests {

        // createInvestment registers a real Spring after-commit hook (to trigger async dividend/
        // coupon/FD backfill once the row is durably saved) — outside a real @Transactional proxy,
        // TransactionSynchronizationManager has no active synchronization to register against, so
        // it throws IllegalStateException unless we open one ourselves. The callback itself never
        // runs here (nothing ever commits), which is fine — these tests don't assert on backfill.
        @BeforeEach
        void activateTransactionSynchronization() {
            TransactionSynchronizationManager.initSynchronization();
        }

        @AfterEach
        void clearTransactionSynchronization() {
            TransactionSynchronizationManager.clearSynchronization();
        }

        @Test
        @DisplayName("merges a new stock buy into an existing active holding instead of duplicating it")
        void mergesStockIntoExistingHolding() {
            Investment existing = withId(baseInvestment()
                    .investmentType(InvestmentType.STOCK).symbol("TCS")
                    .units(new BigDecimal("10")).avgBuyPrice(new BigDecimal("100"))
                    .currentPrice(new BigDecimal("120"))
                    .build());
            when(investmentRepository.findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "TCS", InvestmentType.STOCK))
                    .thenReturn(Optional.of(existing));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(0L);

            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("TCS");
            when(req.getUnits()).thenReturn(new BigDecimal("5"));
            when(req.getAvgBuyPrice()).thenReturn(new BigDecimal("110"));
            when(req.getPurchaseDate()).thenReturn(LocalDate.now());

            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1550"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> inv.getArgument(0));

            InvestmentResponse response = service.createInvestment(userId, req);

            verify(stockTransactionRepository, times(2)).save(any(StockTransaction.class)); // seed + new lot
            verify(assetRepository, never()).save(any());
            assertThat(response.getUnits()).isEqualByComparingTo("15");
            assertThat(response.getAvgBuyPrice()).isEqualByComparingTo("103.3333");
            assertThat(response.getInvestedAmount()).isEqualByComparingTo("1550.00");
        }

        @Test
        @DisplayName("auto-creates a linked asset when assetId is omitted on a new (non-merge) investment")
        void autoCreatesLinkedAsset() {
            CreateInvestmentRequest req = mockRequest();
            when(req.getAssetId()).thenReturn(null);
            when(req.getBankName()).thenReturn("HDFC Bank");
            when(req.getCurrentValue()).thenReturn(new BigDecimal("100000"));
            UUID newAssetId = UUID.randomUUID();
            when(assetRepository.save(any(Asset.class))).thenAnswer(inv -> {
                Asset a = inv.getArgument(0);
                ReflectionTestUtils.setField(a, "id", newAssetId);
                return a;
            });
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });

            InvestmentResponse response = service.createInvestment(userId, req);

            ArgumentCaptor<Asset> assetCaptor = ArgumentCaptor.forClass(Asset.class);
            verify(assetRepository).save(assetCaptor.capture());
            assertThat(assetCaptor.getValue().getName()).isEqualTo("HDFC Bank FD");
            assertThat(response.getAssetId()).isEqualTo(newAssetId);
        }

        @Test
        @DisplayName("rejects an explicit assetId that does not belong to the caller (IDOR guard)")
        void rejectsAssetIdNotOwnedByCaller() {
            UUID foreignAssetId = UUID.randomUUID();
            CreateInvestmentRequest req = mockRequest();
            when(req.getAssetId()).thenReturn(foreignAssetId);
            when(assetRepository.findByIdAndUserId(foreignAssetId, userId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.createInvestment(userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(investmentRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates a debit transfer for investedAmount + brokerage when a debit account is given")
        void createsDebitTransferWithBrokerage() {
            UUID debitAccountId = UUID.randomUUID();
            CreateInvestmentRequest req = mockRequest();
            when(req.getAssetId()).thenReturn(UUID.randomUUID());
            when(assetRepository.findByIdAndUserId(any(), eq(userId))).thenReturn(Optional.of(Asset.builder().build()));
            when(req.getDebitAccountId()).thenReturn(debitAccountId);
            when(req.getInvestedAmount()).thenReturn(new BigDecimal("100000"));
            when(req.getBrokerage()).thenReturn(new BigDecimal("50"));
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });
            when(accountTransferRepository.save(any(AccountTransfer.class))).thenAnswer(inv -> inv.getArgument(0));

            service.createInvestment(userId, req);

            ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(accountTransferRepository).save(transferCaptor.capture());
            assertThat(transferCaptor.getValue().getAmount()).isEqualByComparingTo("100050");
            assertThat(transferCaptor.getValue().getFromAccountId()).isEqualTo(debitAccountId);
        }
    }

    // ─── updateInvestment ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateInvestment")
    class UpdateInvestmentTests {

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown investment")
        void throwsWhenNotFound() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());
            CreateInvestmentRequest req = mockRequest();

            assertThatThrownBy(() -> service.updateInvestment(investmentId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException when the investment belongs to another user")
        void throwsWhenNotOwned() {
            Investment inv = withId(baseInvestment().userId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            CreateInvestmentRequest req = mockRequest();

            assertThatThrownBy(() -> service.updateInvestment(investmentId, userId, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("rejects changing a stock's symbol to one already actively held in a different holding")
        void rejectsDuplicateSymbolOnChange() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS").build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            Investment other = baseInvestment().investmentType(InvestmentType.STOCK).symbol("INFY").build();
            ReflectionTestUtils.setField(other, "id", UUID.randomUUID());
            when(investmentRepository.findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "INFY", InvestmentType.STOCK))
                    .thenReturn(Optional.of(other));

            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("INFY");

            assertThatThrownBy(() -> service.updateInvestment(investmentId, userId, req))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("non-stock update applies financial fields from the request directly")
        void nonStockUpdateAppliesFieldsDirectly() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            CreateInvestmentRequest req = mockRequest();
            when(req.getUnits()).thenReturn(null);
            when(req.getAvgBuyPrice()).thenReturn(null);
            when(req.getCurrentPrice()).thenReturn(null);
            when(req.getInvestedAmount()).thenReturn(new BigDecimal("75000"));
            when(req.getCurrentValue()).thenReturn(new BigDecimal("80000"));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));

            InvestmentResponse response = service.updateInvestment(investmentId, userId, req);

            assertThat(response.getInvestedAmount()).isEqualByComparingTo("75000");
            verify(stockTransactionRepository, never()).findByInvestmentIdOrderByTransactionDateAsc(any());
        }

        @Test
        @DisplayName("syncs the linked asset's currentValue after a successful update")
        void syncsLinkedAssetCurrentValue() {
            UUID assetId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD).assetId(assetId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            Asset asset = Asset.builder().userId(userId).currentValue(BigDecimal.ZERO).build();
            when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestedAmount()).thenReturn(new BigDecimal("60000"));
            when(req.getCurrentValue()).thenReturn(new BigDecimal("65000"));
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));

            service.updateInvestment(investmentId, userId, req);

            ArgumentCaptor<Asset> assetCaptor = ArgumentCaptor.forClass(Asset.class);
            verify(assetRepository).save(assetCaptor.capture());
            assertThat(assetCaptor.getValue().getCurrentValue()).isEqualByComparingTo("65000");
        }
    }

    // ─── deleteInvestment ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteInvestment")
    class DeleteInvestmentTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deleteInvestment(investmentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("soft-deletes (active=false) and deactivates the linked asset when no other active investment references it")
        void softDeletesAndDeactivatesOrphanedAsset() {
            UUID assetId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().assetId(assetId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(assetId, investmentId)).thenReturn(false);
            Asset asset = Asset.builder().active(true).build();
            when(assetRepository.findById(assetId)).thenReturn(Optional.of(asset));

            service.deleteInvestment(investmentId, userId);

            assertThat(inv.isActive()).isFalse();
            assertThat(asset.isActive()).isFalse();
        }

        @Test
        @DisplayName("does NOT deactivate the linked asset while another active investment still references it")
        void keepsAssetActiveWhenStillReferenced() {
            UUID assetId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().assetId(assetId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(assetId, investmentId)).thenReturn(true);

            service.deleteInvestment(investmentId, userId);

            verify(assetRepository, never()).findById(any());
        }

        @Test
        @DisplayName("cleans up the debit transfer when one exists")
        void cleansUpDebitTransfer() {
            UUID transferId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().debitTransferId(transferId).debitAccountId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(any(), any())).thenReturn(true);

            service.deleteInvestment(investmentId, userId);

            verify(accountTransferRepository).deleteById(transferId);
            assertThat(inv.getDebitTransferId()).isNull();
            assertThat(inv.getDebitAccountId()).isNull();
        }
    }

    // ─── Stock transactions (WAC recalculation) ─────────────────────────────────

    @Nested
    @DisplayName("addStockTransaction / deleteStockTransaction (WAC recalculation)")
    class StockTransactionTests {

        private CreateStockTransactionRequest buyRequest(BigDecimal qty, BigDecimal price, BigDecimal brokerage) {
            CreateStockTransactionRequest req = mock(CreateStockTransactionRequest.class);
            lenient().when(req.getTransactionDate()).thenReturn(LocalDate.now());
            lenient().when(req.getTransactionType()).thenReturn("BUY");
            lenient().when(req.getQuantity()).thenReturn(qty);
            lenient().when(req.getPricePerShare()).thenReturn(price);
            lenient().when(req.getBrokerage()).thenReturn(brokerage);
            lenient().when(req.getDebitAccountId()).thenReturn(null);
            return req;
        }

        @Test
        @DisplayName("throws when the investment is not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());
            CreateStockTransactionRequest req = buyRequest(new BigDecimal("10"), new BigDecimal("100"), BigDecimal.ZERO);

            assertThatThrownBy(() -> service.addStockTransaction(investmentId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("WAC after a buy: avgBuyPrice is the weighted average across all buy lots")
        void wacAfterBuy() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").currentPrice(new BigDecimal("120")).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L); // already seeded
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> {
                StockTransaction t = a.getArgument(0);
                ReflectionTestUtils.setField(t, "id", 1L);
                return t;
            });
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("20"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("2200"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("20"));

            CreateStockTransactionRequest req = buyRequest(new BigDecimal("10"), new BigDecimal("120"), BigDecimal.ZERO);
            service.addStockTransaction(investmentId, userId, req);

            assertThat(inv.getAvgBuyPrice()).isEqualByComparingTo("110"); // 2200/20
            assertThat(inv.getUnits()).isEqualByComparingTo("20");
            assertThat(inv.isActive()).isTrue();
        }

        @Test
        @DisplayName("selling the entire position deactivates the investment (netQty = 0)")
        void sellingEntirePositionDeactivates() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).avgBuyPrice(new BigDecimal("100"))
                    .currentPrice(new BigDecimal("120")).active(true).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L);
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> {
                StockTransaction t = a.getArgument(0);
                ReflectionTestUtils.setField(t, "id", 2L);
                return t;
            });
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(BigDecimal.ZERO);

            CreateStockTransactionRequest sellReq = mock(CreateStockTransactionRequest.class);
            when(sellReq.getTransactionDate()).thenReturn(LocalDate.now());
            when(sellReq.getTransactionType()).thenReturn("SELL");
            when(sellReq.getQuantity()).thenReturn(new BigDecimal("10"));
            when(sellReq.getPricePerShare()).thenReturn(new BigDecimal("120"));
            lenient().when(sellReq.getBrokerage()).thenReturn(BigDecimal.ZERO);
            lenient().when(sellReq.getDebitAccountId()).thenReturn(null);

            service.addStockTransaction(investmentId, userId, sellReq);

            assertThat(inv.isActive()).isFalse();
            assertThat(inv.getUnits()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("a sell credits proceeds (qty*price - brokerage) to the debit account when one is given")
        void sellCreditsProceedsToAccount() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).avgBuyPrice(new BigDecimal("100"))
                    .currentPrice(new BigDecimal("120")).active(true).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L);
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("5"));

            CreateStockTransactionRequest sellReq = mock(CreateStockTransactionRequest.class);
            when(sellReq.getTransactionDate()).thenReturn(LocalDate.now());
            when(sellReq.getTransactionType()).thenReturn("SELL");
            when(sellReq.getQuantity()).thenReturn(new BigDecimal("5"));
            when(sellReq.getPricePerShare()).thenReturn(new BigDecimal("120"));
            when(sellReq.getBrokerage()).thenReturn(new BigDecimal("10"));
            when(sellReq.getDebitAccountId()).thenReturn(accountId);

            service.addStockTransaction(investmentId, userId, sellReq);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(accountTransferRepository).save(captor.capture());
            assertThat(captor.getValue().getToAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("590"); // 5*120 - 10
        }

        @Test
        @DisplayName("deleteStockTransaction removes the row and recalculates WAC totals")
        void deleteRecalculatesTotals() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS").build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));

            service.deleteStockTransaction(investmentId, 5L, userId);

            verify(stockTransactionRepository).deleteById(5L);
            assertThat(inv.getAvgBuyPrice()).isEqualByComparingTo("100");
        }
    }

    // ─── SIP transactions ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("addSipTransaction / deleteSipTransaction")
    class SipTransactionTests {

        @Test
        @DisplayName("recomputes investedAmount, units and avgBuyPrice as sums across all SIP buys")
        void recomputesTotalsFromSipLedger() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.MUTUAL_FUND)
                    .currentPrice(new BigDecimal("50")).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(sipTransactionRepository.save(any(SipTransaction.class))).thenAnswer(a -> {
                SipTransaction t = a.getArgument(0);
                ReflectionTestUtils.setField(t, "id", 1L);
                return t;
            });
            when(sipTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("10000"));
            when(sipTransactionRepository.sumUnitsByInvestmentId(investmentId)).thenReturn(new BigDecimal("200"));

            CreateSipTransactionRequest req = mock(CreateSipTransactionRequest.class);
            when(req.getTransactionDate()).thenReturn(LocalDate.now());
            when(req.getAmount()).thenReturn(new BigDecimal("5000"));
            lenient().when(req.getUnits()).thenReturn(new BigDecimal("100"));
            lenient().when(req.getNav()).thenReturn(new BigDecimal("50"));
            lenient().when(req.getTransactionType()).thenReturn("BUY");

            SipTransactionResponse response = service.addSipTransaction(investmentId, userId, req);

            assertThat(response.getAmount()).isEqualByComparingTo("5000");
            assertThat(inv.getInvestedAmount()).isEqualByComparingTo("10000");
            assertThat(inv.getUnits()).isEqualByComparingTo("200");
            assertThat(inv.getAvgBuyPrice()).isEqualByComparingTo("50"); // 10000/200
            assertThat(inv.getCurrentValue()).isEqualByComparingTo("10000"); // 200 * currentPrice(50)
        }

        @Test
        @DisplayName("deleteSipTransaction recalculates totals down to zero when it was the only buy")
        void deleteRecalculatesToZero() {
            SipTransaction st = SipTransaction.builder().investmentId(investmentId).build();
            ReflectionTestUtils.setField(st, "id", 1L);
            when(sipTransactionRepository.findById(1L)).thenReturn(Optional.of(st));
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.MUTUAL_FUND).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(sipTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(BigDecimal.ZERO);
            when(sipTransactionRepository.sumUnitsByInvestmentId(investmentId)).thenReturn(BigDecimal.ZERO);

            service.deleteSipTransaction(1L, userId);

            verify(sipTransactionRepository).delete(st);
            assertThat(inv.getInvestedAmount()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("throws when the SIP transaction's parent investment is not owned by the caller")
        void throwsWhenParentInvestmentNotOwned() {
            SipTransaction st = SipTransaction.builder().investmentId(investmentId).build();
            ReflectionTestUtils.setField(st, "id", 1L);
            when(sipTransactionRepository.findById(1L)).thenReturn(Optional.of(st));
            Investment inv = withId(baseInvestment().userId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));

            assertThatThrownBy(() -> service.deleteSipTransaction(1L, userId))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }
}
