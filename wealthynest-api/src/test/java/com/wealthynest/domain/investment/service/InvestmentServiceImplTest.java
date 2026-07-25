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
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.request.CreateStockTransactionRequest;
import com.wealthynest.domain.investment.dto.request.DismissDividendRequest;
import com.wealthynest.domain.investment.dto.request.LogIncomeRequest;
import com.wealthynest.domain.investment.dto.response.DividendSuggestionResponse;
import com.wealthynest.domain.investment.dto.response.IncomeHistoryResponse;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.dto.response.InvestmentSearchResult;
import com.wealthynest.domain.investment.dto.response.SipTransactionResponse;
import com.wealthynest.domain.investment.dto.response.StockTransactionResponse;
import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
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

        @Test
        @DisplayName("accepts an explicit assetId that the caller does own")
        void acceptsAssetIdOwnedByCaller() {
            UUID assetId = UUID.randomUUID();
            CreateInvestmentRequest req = mockRequest();
            when(req.getAssetId()).thenReturn(assetId);
            when(assetRepository.findByIdAndUserId(assetId, userId))
                    .thenReturn(Optional.of(Asset.builder().userId(userId).build()));
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });

            InvestmentResponse response = service.createInvestment(userId, req);

            assertThat(response.getAssetId()).isEqualTo(assetId);
            verify(assetRepository, never()).save(any());
        }

        @Test
        @DisplayName("merging into an existing holding skips re-seeding the opening transaction when one already exists")
        void mergeSkipsSeedWhenAlreadyTracked() {
            Investment existing = withId(baseInvestment()
                    .investmentType(InvestmentType.STOCK).symbol("TCS")
                    .units(new BigDecimal("10")).avgBuyPrice(new BigDecimal("100"))
                    .currentPrice(new BigDecimal("120")).build());
            when(investmentRepository.findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "TCS", InvestmentType.STOCK))
                    .thenReturn(Optional.of(existing));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L); // already seeded

            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("TCS");
            when(req.getUnits()).thenReturn(new BigDecimal("5"));
            when(req.getAvgBuyPrice()).thenReturn(new BigDecimal("110"));
            when(req.getPurchaseDate()).thenReturn(LocalDate.now());
            when(req.getDebitAccountId()).thenReturn(null);

            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1550"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> inv.getArgument(0));

            service.createInvestment(userId, req);

            verify(stockTransactionRepository, times(1)).save(any(StockTransaction.class)); // only the new lot, no seed
            verifyNoInteractions(accountOwnershipGuard, accountTransferRepository);
        }

        @Test
        @DisplayName("a brand-new (non-merged) STOCK investment seeds its opening BUY transaction")
        void newStockInvestmentSeedsOpeningTransaction() {
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("INFY");
            when(req.getUnits()).thenReturn(new BigDecimal("10"));
            when(req.getAvgBuyPrice()).thenReturn(new BigDecimal("1500"));
            when(investmentRepository.findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, "INFY", InvestmentType.STOCK))
                    .thenReturn(Optional.empty());
            when(assetRepository.save(any(Asset.class))).thenAnswer(a -> {
                Asset asset = a.getArgument(0);
                ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
                return asset;
            });
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });

            service.createInvestment(userId, req);

            ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
            verify(stockTransactionRepository).save(captor.capture());
            assertThat(captor.getValue().getInvestmentId()).isEqualTo(investmentId);
            assertThat(captor.getValue().getQuantity()).isEqualByComparingTo("10");
        }

        @Test
        @DisplayName("goldKarat/exchange/tdsRate/brokerage default when the request omits them")
        void defaultsApplyWhenOptionalFieldsOmitted() {
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.GOLD);
            when(req.getExchange()).thenReturn(null);
            when(req.getGoldKarat()).thenReturn(null);
            when(req.getTdsRate()).thenReturn(null);
            when(req.getBrokerage()).thenReturn(null);
            when(assetRepository.save(any(Asset.class))).thenAnswer(a -> {
                Asset asset = a.getArgument(0);
                ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
                return asset;
            });
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });

            service.createInvestment(userId, req);

            ArgumentCaptor<Investment> captor = ArgumentCaptor.forClass(Investment.class);
            verify(investmentRepository).save(captor.capture());
            assertThat(captor.getValue().getExchange()).isEqualTo("NSE");
            assertThat(captor.getValue().getGoldKarat()).isEqualTo(22);
            assertThat(captor.getValue().getTdsRate()).isEqualByComparingTo("0");
            assertThat(captor.getValue().getBrokerage()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("the after-commit hook backfills dividends for a STOCK, bond coupons for a BOND, and FD maturity for an FD")
        void afterCommitHookDispatchesBackfillByType() {
            when(assetRepository.save(any(Asset.class))).thenAnswer(a -> {
                Asset asset = a.getArgument(0);
                ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
                return asset;
            });
            for (var pair : java.util.Map.of(
                    InvestmentType.STOCK, (Runnable) () -> verify(autoIncomeScheduler).backfillDividendsForStock(any()),
                    InvestmentType.BOND,  (Runnable) () -> verify(autoIncomeScheduler).backfillBondCoupons(any()),
                    InvestmentType.FD,    (Runnable) () -> verify(autoIncomeScheduler).backfillFDMaturity(any())
            ).entrySet()) {
                clearInvocations(autoIncomeScheduler);
                CreateInvestmentRequest req = mockRequest();
                when(req.getInvestmentType()).thenReturn(pair.getKey());
                when(req.getSymbol()).thenReturn(pair.getKey() == InvestmentType.STOCK ? "TCS" : null);
                when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                    Investment i = inv.getArgument(0);
                    ReflectionTestUtils.setField(i, "id", UUID.randomUUID());
                    return i;
                });

                service.createInvestment(userId, req);
                TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
                TransactionSynchronizationManager.clearSynchronization();
                TransactionSynchronizationManager.initSynchronization();

                pair.getValue().run();
            }
        }

        @Test
        @DisplayName("the after-commit hook does not backfill anything for a type with no auto-income source (e.g. PPF)")
        void afterCommitHookSkipsBackfillForUnsupportedType() {
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.PPF);
            when(assetRepository.save(any(Asset.class))).thenAnswer(a -> {
                Asset asset = a.getArgument(0);
                ReflectionTestUtils.setField(asset, "id", UUID.randomUUID());
                return asset;
            });
            when(investmentRepository.save(any(Investment.class))).thenAnswer(inv -> {
                Investment i = inv.getArgument(0);
                ReflectionTestUtils.setField(i, "id", investmentId);
                return i;
            });

            service.createInvestment(userId, req);
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());

            verifyNoInteractions(autoIncomeScheduler);
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

        @Test
        @DisplayName("syncs the linked debit transfer's amount when a non-stock's investedAmount changes")
        void syncsDebitTransferAmountOnInvestedAmountChange() {
            UUID transferId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("50000")).debitTransferId(transferId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            AccountTransfer transfer = AccountTransfer.builder().amount(new BigDecimal("50000")).build();
            when(accountTransferRepository.findById(transferId)).thenReturn(Optional.of(transfer));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestedAmount()).thenReturn(new BigDecimal("70000"));

            service.updateInvestment(investmentId, userId, req);

            assertThat(transfer.getAmount()).isEqualByComparingTo("70000");
            verify(accountTransferRepository).save(transfer);
        }

        @Test
        @DisplayName("does not touch the debit transfer when investedAmount is unchanged")
        void skipsDebitTransferSyncWhenAmountUnchanged() {
            UUID transferId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD)
                    .investedAmount(new BigDecimal("50000")).debitTransferId(transferId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestedAmount()).thenReturn(new BigDecimal("50000")); // same as existing

            service.updateInvestment(investmentId, userId, req);

            verifyNoInteractions(accountTransferRepository);
        }

        @Test
        @DisplayName("STOCK update with only a seed transaction on record: updates the seed's units/price in place")
        void stockUpdateWithOnlySeedUpdatesSeedInPlace() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS")
                    .purchaseDate(LocalDate.of(2025, 1, 1)).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            StockTransaction seed = StockTransaction.builder()
                    .investmentId(investmentId).transactionType("BUY")
                    .quantity(new BigDecimal("10")).pricePerShare(new BigDecimal("100")).build();
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId))
                    .thenReturn(List.of(seed));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("20"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("2200"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("20"));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("TCS");
            when(req.getUnits()).thenReturn(new BigDecimal("20"));
            when(req.getAvgBuyPrice()).thenReturn(new BigDecimal("110"));

            service.updateInvestment(investmentId, userId, req);

            assertThat(seed.getQuantity()).isEqualByComparingTo("20");
            assertThat(seed.getPricePerShare()).isEqualByComparingTo("110");
            verify(stockTransactionRepository).save(seed);
        }

        @Test
        @DisplayName("STOCK update with no transactions on record yet: creates a new seed transaction")
        void stockUpdateWithNoTransactionsCreatesSeed() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS").build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId))
                    .thenReturn(List.of());
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1500"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("TCS");
            when(req.getUnits()).thenReturn(new BigDecimal("15"));
            when(req.getAvgBuyPrice()).thenReturn(new BigDecimal("100"));

            service.updateInvestment(investmentId, userId, req);

            ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
            verify(stockTransactionRepository).save(captor.capture());
            assertThat(captor.getValue().getInvestmentId()).isEqualTo(investmentId);
            assertThat(captor.getValue().getNotes()).contains("Opening position");
        }

        @Test
        @DisplayName("STOCK update with buy-more/sell history already on record: units/avgBuyPrice edits are ignored, not double-counted")
        void stockUpdateWithMultipleTransactionsSkipsSeedEdit() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS").build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            StockTransaction seed = StockTransaction.builder().investmentId(investmentId).transactionType("BUY").build();
            StockTransaction buyMore = StockTransaction.builder().investmentId(investmentId).transactionType("BUY").build();
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId))
                    .thenReturn(List.of(seed, buyMore));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("30"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("3000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("30"));
            CreateInvestmentRequest req = mockRequest();
            when(req.getInvestmentType()).thenReturn(InvestmentType.STOCK);
            when(req.getSymbol()).thenReturn("TCS");
            // getUnits()/getAvgBuyPrice() are deliberately not stubbed here — with 2 transactions
            // already on record, txns.size() <= 1 is false and short-circuits before either is read.

            service.updateInvestment(investmentId, userId, req);

            verify(stockTransactionRepository, never()).save(any(StockTransaction.class));
            assertThat(inv.getUnits()).isEqualByComparingTo("30"); // from recalculateStockTotals, not the request
        }

        @Test
        @DisplayName("a null goldKarat in the request leaves the investment's existing goldKarat untouched")
        void nullGoldKaratKeepsExisting() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.GOLD).goldKarat(18).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            CreateInvestmentRequest req = mockRequest();
            when(req.getGoldKarat()).thenReturn(null);

            service.updateInvestment(investmentId, userId, req);

            assertThat(inv.getGoldKarat()).isEqualTo(18);
        }

        @Test
        @DisplayName("moves existing income-log entries to the new linked account only when the account actually changed")
        void movesIncomeEntriesWhenLinkedAccountChanges() {
            UUID oldAccountId = UUID.randomUUID();
            UUID newAccountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD).linkedAccountId(oldAccountId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));

            UUID incomeEntryId = UUID.randomUUID();
            InvestmentIncomeLog log = InvestmentIncomeLog.builder()
                    .investmentId(investmentId).incomeEntryId(incomeEntryId).build();
            when(incomeLogRepository.findByInvestmentId(investmentId)).thenReturn(List.of(log));
            com.wealthynest.domain.income.entity.IncomeEntry entry =
                    com.wealthynest.domain.income.entity.IncomeEntry.builder().accountId(oldAccountId).build();
            when(incomeRepository.findById(incomeEntryId)).thenReturn(Optional.of(entry));

            CreateInvestmentRequest req = mockRequest();
            when(req.getLinkedAccountId()).thenReturn(newAccountId);

            service.updateInvestment(investmentId, userId, req);

            assertThat(entry.getAccountId()).isEqualTo(newAccountId);
            verify(incomeRepository).save(entry);
        }

        @Test
        @DisplayName("does not move income entries when the linked account is unchanged")
        void skipsMovingIncomeEntriesWhenAccountUnchanged() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD).linkedAccountId(accountId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));
            CreateInvestmentRequest req = mockRequest();
            when(req.getLinkedAccountId()).thenReturn(accountId); // same

            service.updateInvestment(investmentId, userId, req);

            verifyNoInteractions(incomeLogRepository);
        }

        @Test
        @DisplayName("an income entry whose account no longer matches the old linked account is left untouched")
        void leavesUnrelatedIncomeEntryUntouched() {
            UUID oldAccountId = UUID.randomUUID();
            UUID newAccountId = UUID.randomUUID();
            UUID unrelatedAccountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.FD).linkedAccountId(oldAccountId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(assetRepository.findById(any())).thenReturn(Optional.empty());
            when(investmentRepository.save(any(Investment.class))).thenAnswer(a -> a.getArgument(0));

            UUID incomeEntryId = UUID.randomUUID();
            InvestmentIncomeLog log = InvestmentIncomeLog.builder()
                    .investmentId(investmentId).incomeEntryId(incomeEntryId).build();
            when(incomeLogRepository.findByInvestmentId(investmentId)).thenReturn(List.of(log));
            com.wealthynest.domain.income.entity.IncomeEntry entry =
                    com.wealthynest.domain.income.entity.IncomeEntry.builder().accountId(unrelatedAccountId).build();
            when(incomeRepository.findById(incomeEntryId)).thenReturn(Optional.of(entry));

            CreateInvestmentRequest req = mockRequest();
            when(req.getLinkedAccountId()).thenReturn(newAccountId);

            service.updateInvestment(investmentId, userId, req);

            assertThat(entry.getAccountId()).isEqualTo(unrelatedAccountId); // unchanged
            verify(incomeRepository, never()).save(any());
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
        @DisplayName("throws AccessDeniedException when the investment belongs to another user")
        void throwsWhenNotOwned() {
            Investment inv = withId(baseInvestment().userId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            CreateStockTransactionRequest req = buyRequest(new BigDecimal("10"), new BigDecimal("100"), BigDecimal.ZERO);

            assertThatThrownBy(() -> service.addStockTransaction(investmentId, userId, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("retroactively seeds the opening BUY transaction for an investment created before transaction tracking existed")
        void retroactivelySeedsOpeningTransactionWhenNoneExist() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS")
                    .units(new BigDecimal("10")).avgBuyPrice(new BigDecimal("100"))
                    .currentPrice(new BigDecimal("120")).purchaseDate(LocalDate.of(2024, 1, 1)).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(0L); // no ledger yet
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1550"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("15"));
            CreateStockTransactionRequest req = buyRequest(new BigDecimal("5"), new BigDecimal("110"), BigDecimal.ZERO);

            service.addStockTransaction(investmentId, userId, req);

            ArgumentCaptor<StockTransaction> captor = ArgumentCaptor.forClass(StockTransaction.class);
            verify(stockTransactionRepository, times(2)).save(captor.capture()); // seed + new lot
            assertThat(captor.getAllValues().get(0).getNotes()).contains("Opening position");
            assertThat(captor.getAllValues().get(0).getQuantity()).isEqualByComparingTo("10"); // from inv's pre-ledger units
        }

        @Test
        @DisplayName("a BUY with a debit account debits the cost (quantity*price + brokerage) from it")
        void buyDebitsCostFromAccount() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS")
                    .currentPrice(new BigDecimal("120")).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L);
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            CreateStockTransactionRequest req = buyRequest(new BigDecimal("10"), new BigDecimal("100"), new BigDecimal("20"));
            when(req.getDebitAccountId()).thenReturn(accountId);

            service.addStockTransaction(investmentId, userId, req);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(accountTransferRepository).save(captor.capture());
            assertThat(captor.getValue().getFromAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("1020"); // 10*100 + 20
        }

        @Test
        @DisplayName("a SELL whose proceeds after brokerage are zero or negative does not credit the account")
        void sellWithNonPositiveProceedsSkipsCredit() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK).symbol("TCS")
                    .units(new BigDecimal("10")).currentPrice(new BigDecimal("100")).build());
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
            when(sellReq.getPricePerShare()).thenReturn(new BigDecimal("10"));
            when(sellReq.getBrokerage()).thenReturn(new BigDecimal("100")); // brokerage exceeds gross proceeds
            when(sellReq.getDebitAccountId()).thenReturn(accountId);

            service.addStockTransaction(investmentId, userId, sellReq);

            verifyNoInteractions(accountTransferRepository);
        }

        @Test
        @DisplayName("falls back to companyName for the transfer description when the investment has no symbol")
        void fallsBackToCompanyNameWhenNoSymbol() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol(null).companyName("Some Startup Pvt Ltd").currentPrice(new BigDecimal("100")).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            when(stockTransactionRepository.countByInvestmentId(investmentId)).thenReturn(1L);
            when(stockTransactionRepository.save(any(StockTransaction.class))).thenAnswer(a -> a.getArgument(0));
            when(stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            when(stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId)).thenReturn(new BigDecimal("1000"));
            when(stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)).thenReturn(new BigDecimal("10"));
            CreateStockTransactionRequest req = buyRequest(new BigDecimal("10"), new BigDecimal("100"), BigDecimal.ZERO);
            when(req.getDebitAccountId()).thenReturn(accountId);

            service.addStockTransaction(investmentId, userId, req);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(accountTransferRepository).save(captor.capture());
            assertThat(captor.getValue().getDescription()).contains("Some Startup Pvt Ltd");
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

    // ─── Live price overlay (enrich) ───────────────────────────────────────────────

    @Nested
    @DisplayName("Live price overlay (enrich via getInvestments)")
    class LivePriceOverlayTests {

        @Test
        @DisplayName("STOCK: overlays live cache price and recomputes currentValue/day-change fields")
        void stockOverlaysLiveCache() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).build());
            StockPriceCache cache = StockPriceCache.builder()
                    .symbol("TCS").currentPrice(new BigDecimal("150"))
                    .dayChange(new BigDecimal("5")).dayChangePct(new BigDecimal("3.4"))
                    .week52High(new BigDecimal("200")).week52Low(new BigDecimal("100"))
                    .lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(stockPriceCacheRepository.findById("TCS")).thenReturn(Optional.of(cache));
            // getInvestments batches this via enrichAll (one grouped query for the whole list)
            // rather than enrich's own single-item countByInvestmentId fallback — see
            // StockTransactionRepository#countByInvestmentIdIn.
            when(stockTransactionRepository.countByInvestmentIdIn(List.of(investmentId)))
                    .thenReturn(java.util.Collections.singletonList(new Object[]{investmentId, 3L}));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getLivePrice()).isEqualByComparingTo("150");
            assertThat(response.getCurrentValue()).isEqualByComparingTo("1500");
            assertThat(response.getDayChange()).isEqualByComparingTo("5");
            assertThat(response.getWeek52High()).isEqualByComparingTo("200");
            assertThat(response.getTransactionCount()).isEqualTo(3);
        }

        @Test
        @DisplayName("STOCK: missing cache row leaves stored currentValue untouched")
        void stockMissingCacheKeepsStoredValue() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("ZZZZ").units(new BigDecimal("10")).currentValue(new BigDecimal("999")).build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(stockPriceCacheRepository.findById("ZZZZ")).thenReturn(Optional.empty());

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getLivePrice()).isNull();
            assertThat(response.getCurrentValue()).isEqualByComparingTo("999");
        }

        @Test
        @DisplayName("MUTUAL_FUND: overlays live NAV and recomputes currentValue")
        void mutualFundOverlaysNav() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.MUTUAL_FUND)
                    .schemeCode("MF001").units(new BigDecimal("100")).build());
            MFNavCache cache = MFNavCache.builder().schemeCode("MF001").nav(new BigDecimal("25"))
                    .lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(mfNavCacheRepository.findById("MF001")).thenReturn(Optional.of(cache));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getLivePrice()).isEqualByComparingTo("25");
            assertThat(response.getCurrentValue()).isEqualByComparingTo("2500");
        }

        @Test
        @DisplayName("GOLD karat 24: uses price24kPerGram directly")
        void gold24Karat() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.GOLD)
                    .goldKarat(24).quantityGrams(new BigDecimal("10")).build());
            GoldPriceCache cache = GoldPriceCache.builder()
                    .price24kPerGram(new BigDecimal("6000")).lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getCurrentValue()).isEqualByComparingTo("60000.00");
        }

        @Test
        @DisplayName("GOLD_ETF karat 18 with explicit price18kPerGram: uses it directly")
        void gold18KaratExplicit() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.GOLD_ETF)
                    .goldKarat(18).quantityGrams(new BigDecimal("10")).build());
            GoldPriceCache cache = GoldPriceCache.builder()
                    .price18kPerGram(new BigDecimal("4500")).lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getCurrentValue()).isEqualByComparingTo("45000.00");
        }

        @Test
        @DisplayName("GOLD karat 18 derived from 24k when price18kPerGram is absent")
        void gold18KaratDerivedFrom24k() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.GOLD)
                    .goldKarat(18).quantityGrams(new BigDecimal("10")).build());
            GoldPriceCache cache = GoldPriceCache.builder()
                    .price24kPerGram(new BigDecimal("6000")).lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            // 6000 * 18/24 = 4500 per gram * 10 grams
            assertThat(response.getCurrentValue()).isEqualByComparingTo("45000.00");
        }

        @Test
        @DisplayName("GOLD default (22k) karat uses price22kPerGram")
        void goldDefaultKarat() {
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.GOLD)
                    .goldKarat(22).quantityGrams(new BigDecimal("10")).build());
            GoldPriceCache cache = GoldPriceCache.builder()
                    .price22kPerGram(new BigDecimal("5500")).lastUpdated(Instant.now()).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getCurrentValue()).isEqualByComparingTo("55000.00");
        }

        @Test
        @DisplayName("resolves and returns the debit account's name when a debit account is linked")
        void resolvesDebitAccountName() {
            UUID debitAccountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().investmentType(InvestmentType.PPF)
                    .debitAccountId(debitAccountId).build());
            WalletAccount account = WalletAccount.builder().name("HDFC Savings").build();
            ReflectionTestUtils.setField(account, "id", debitAccountId);
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            // getInvestments batches this via enrichAll (one findAllById for the whole list)
            // rather than enrich's own single-item findById fallback.
            when(accountRepository.findAllById(List.of(debitAccountId))).thenReturn(List.of(account));

            InvestmentResponse response = service.getInvestments(userId).get(0);

            assertThat(response.getDebitAccountName()).isEqualTo("HDFC Savings");
        }
    }

    // ─── Gold price endpoints ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("getGoldPrice22k / getGoldPriceAllKarats / getGoldPriceInfo")
    class GoldPriceEndpointTests {

        @Test
        @DisplayName("getGoldPrice22k returns cached value when present")
        void goldPrice22kFromCache() {
            GoldPriceCache cache = GoldPriceCache.builder().price22kPerGram(new BigDecimal("5500")).build();
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            assertThat(service.getGoldPrice22k()).isEqualByComparingTo("5500");
            verify(externalPriceService, never()).fetchGoldPrice22k();
        }

        @Test
        @DisplayName("getGoldPrice22k falls back to the external service when no cache row exists")
        void goldPrice22kFallsBackToExternal() {
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(externalPriceService.fetchGoldPrice22k()).thenReturn(new BigDecimal("5600"));

            assertThat(service.getGoldPrice22k()).isEqualByComparingTo("5600");
        }

        @Test
        @DisplayName("getGoldPriceAllKarats derives 24k/18k from 22k when cache only has 22k")
        void allKaratsDerivedFrom22k() {
            GoldPriceCache cache = GoldPriceCache.builder().price22kPerGram(new BigDecimal("5500")).build();
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            var result = service.getGoldPriceAllKarats();

            assertThat(result.get("price22k")).isEqualByComparingTo("5500");
            assertThat(result.get("price24k")).isEqualByComparingTo("6000.00"); // 5500*24/22
            assertThat(result.get("price18k")).isEqualByComparingTo("4500.00"); // 6000*18/24
        }

        @Test
        @DisplayName("getGoldPriceAllKarats falls back to external fetchGoldPriceData when no cache exists")
        void allKaratsFallsBackToExternal() {
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(externalPriceService.fetchGoldPriceData()).thenReturn(
                    new ExternalPriceService.GoldPriceData(
                            new BigDecimal("5600"), new BigDecimal("6100"), new BigDecimal("4600"),
                            new BigDecimal("2000"), new BigDecimal("83")));

            var result = service.getGoldPriceAllKarats();

            assertThat(result.get("price22k")).isEqualByComparingTo("5600");
            assertThat(result.get("price24k")).isEqualByComparingTo("6100");
            assertThat(result.get("price18k")).isEqualByComparingTo("4600");
        }

        @Test
        @DisplayName("getGoldPriceAllKarats returns an empty map when both cache and external fetch fail")
        void allKaratsEmptyWhenExternalFetchReturnsNull() {
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(externalPriceService.fetchGoldPriceData()).thenReturn(null);

            assertThat(service.getGoldPriceAllKarats()).isEmpty();
        }

        @Test
        @DisplayName("getGoldPriceInfo includes lastUpdated timestamp from the cache")
        void goldPriceInfoFromCache() {
            Instant updated = Instant.now();
            GoldPriceCache cache = GoldPriceCache.builder()
                    .price22kPerGram(new BigDecimal("5500")).lastUpdated(updated).build();
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.of(cache));

            var result = service.getGoldPriceInfo();

            assertThat(result.get("lastUpdated")).isEqualTo(updated.toString());
            assertThat((BigDecimal) result.get("price22k")).isEqualByComparingTo("5500");
        }

        @Test
        @DisplayName("getGoldPriceInfo falls back to external data with a null lastUpdated when no cache exists")
        void goldPriceInfoFallsBackToExternal() {
            when(goldPriceCacheRepository.findById(1)).thenReturn(Optional.empty());
            when(externalPriceService.fetchGoldPriceData()).thenReturn(
                    new ExternalPriceService.GoldPriceData(
                            new BigDecimal("5600"), new BigDecimal("6100"), new BigDecimal("4600"),
                            new BigDecimal("2000"), new BigDecimal("83")));

            var result = service.getGoldPriceInfo();

            assertThat(result.get("lastUpdated")).isNull();
            assertThat((BigDecimal) result.get("price22k")).isEqualByComparingTo("5600");
        }
    }

    // ─── Search ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("searchStocks / searchMF")
    class SearchTests {

        @Test
        @DisplayName("searchStocks returns empty list for a null or blank query without touching repositories")
        void searchStocksBlankQueryShortCircuits() {
            assertThat(service.searchStocks(null)).isEmpty();
            assertThat(service.searchStocks("   ")).isEmpty();
            verifyNoInteractions(stockMasterRepository, externalPriceService);
        }

        @Test
        @DisplayName("searchStocks supplements local NSE results with BSE results not already present")
        void searchStocksSupplementsWithBse() {
            StockMaster nse = StockMaster.builder().symbol("TCS").companyName("Tata Consultancy").exchange("NSE").build();
            when(stockMasterRepository.search(eq("tcs"), any(Pageable.class))).thenReturn(List.of(nse));
            when(externalPriceService.searchBSEStocks("tcs")).thenReturn(List.of(
                    InvestmentSearchResult.builder().symbol("TCS").exchange("BSE").type("STOCK").build(), // dup of NSE symbol -> excluded
                    InvestmentSearchResult.builder().symbol("RELBSE").exchange("BSE").type("STOCK").build() // new -> included
            ));

            List<InvestmentSearchResult> results = service.searchStocks("tcs");

            assertThat(results).extracting(InvestmentSearchResult::getSymbol).containsExactly("TCS", "RELBSE");
        }

        @Test
        @DisplayName("searchStocks caps combined results at 20")
        void searchStocksCapsAt20() {
            List<StockMaster> dbResults = java.util.stream.IntStream.range(0, 15)
                    .mapToObj(i -> StockMaster.builder().symbol("NSE" + i).companyName("C" + i).exchange("NSE").build())
                    .toList();
            when(stockMasterRepository.search(eq("x"), any(Pageable.class))).thenReturn(dbResults);
            List<InvestmentSearchResult> bseResults = java.util.stream.IntStream.range(0, 10)
                    .mapToObj(i -> InvestmentSearchResult.builder().symbol("BSE" + i).exchange("BSE").type("STOCK").build())
                    .toList();
            when(externalPriceService.searchBSEStocks("x")).thenReturn(bseResults);

            List<InvestmentSearchResult> results = service.searchStocks("x");

            assertThat(results).hasSize(20);
        }

        @Test
        @DisplayName("searchMF returns empty list for a null or blank query without touching the repository")
        void searchMfBlankQueryShortCircuits() {
            assertThat(service.searchMF(null)).isEmpty();
            assertThat(service.searchMF("")).isEmpty();
            verifyNoInteractions(mfMasterRepository);
        }

        @Test
        @DisplayName("searchMF maps local mf_master results to search results")
        void searchMfReturnsResults() {
            MfMaster mf = MfMaster.builder().schemeCode("MF1").schemeName("Axis Bluechip").build();
            when(mfMasterRepository.search(eq("axis"), any(Pageable.class))).thenReturn(List.of(mf));

            List<InvestmentSearchResult> results = service.searchMF("axis");

            assertThat(results).hasSize(1);
            assertThat(results.get(0).getSchemeCode()).isEqualTo("MF1");
            assertThat(results.get(0).getName()).isEqualTo("Axis Bluechip");
        }
    }

    // ─── Dividend suggestions ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getDividendSuggestions")
    class DividendSuggestionTests {

        @Test
        @DisplayName("suggests a dividend for a held stock with an ex-date after purchase, not yet dismissed or logged")
        void suggestsUndismissedUnloggedDividend() {
            Investment stock = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).purchaseDate(LocalDate.now().minusYears(1)).build());
            NseCorporateAction ca = NseCorporateAction.builder()
                    .symbol("TCS").exDate(LocalDate.now().minusDays(10)).dividendPerShare(new BigDecimal("5")).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(stock));
            when(dismissedDividendRepository.findByUserId(userId)).thenReturn(List.of());
            when(corpActionRepository.findBySymbolAndExDateAfterOrderByExDateDesc("TCS", stock.getPurchaseDate()))
                    .thenReturn(List.of(ca));
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    investmentId, "DIVIDEND", ca.getExDate())).thenReturn(false);

            List<DividendSuggestionResponse> result = service.getDividendSuggestions(userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getSuggestedIncome()).isEqualByComparingTo("50");
            assertThat(result.get(0).isAlreadyLogged()).isFalse();
        }

        @Test
        @DisplayName("skips a dismissed dividend suggestion")
        void skipsDismissedSuggestion() {
            Investment stock = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).purchaseDate(LocalDate.now().minusYears(1)).build());
            LocalDate exDate = LocalDate.now().minusDays(10);
            NseCorporateAction ca = NseCorporateAction.builder()
                    .symbol("TCS").exDate(exDate).dividendPerShare(new BigDecimal("5")).build();
            DismissedDividend dismissed = DismissedDividend.builder()
                    .userId(userId).investmentId(investmentId).exDate(exDate).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(stock));
            when(dismissedDividendRepository.findByUserId(userId)).thenReturn(List.of(dismissed));
            when(corpActionRepository.findBySymbolAndExDateAfterOrderByExDateDesc("TCS", stock.getPurchaseDate()))
                    .thenReturn(List.of(ca));

            List<DividendSuggestionResponse> result = service.getDividendSuggestions(userId);

            assertThat(result).isEmpty();
            verify(incomeLogRepository, never()).existsByInvestmentIdAndIncomeTypeAndEventDate(any(), any(), any());
        }

        @Test
        @DisplayName("skips a corporate action with a zero or negative dividendPerShare")
        void skipsNonPositiveDividend() {
            Investment stock = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).purchaseDate(LocalDate.now().minusYears(1)).build());
            NseCorporateAction ca = NseCorporateAction.builder()
                    .symbol("TCS").exDate(LocalDate.now().minusDays(10)).dividendPerShare(BigDecimal.ZERO).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(stock));
            when(dismissedDividendRepository.findByUserId(userId)).thenReturn(List.of());
            when(corpActionRepository.findBySymbolAndExDateAfterOrderByExDateDesc("TCS", stock.getPurchaseDate()))
                    .thenReturn(List.of(ca));

            assertThat(service.getDividendSuggestions(userId)).isEmpty();
        }

        @Test
        @DisplayName("non-stock and stocks with missing symbol/units/purchaseDate are filtered out before lookup")
        void filtersIneligibleInvestments() {
            Investment fd = withId(baseInvestment().investmentType(InvestmentType.FD).build());
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(fd));
            when(dismissedDividendRepository.findByUserId(userId)).thenReturn(List.of());

            assertThat(service.getDividendSuggestions(userId)).isEmpty();
            verifyNoInteractions(corpActionRepository);
        }
    }

    // ─── logIncome ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("logIncome")
    class LogIncomeTests {

        @Test
        @DisplayName("throws when the investment is not found")
        void throwsWhenNotFound() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());
            LogIncomeRequest req = new LogIncomeRequest();
            req.setIncomeType("DIVIDEND"); req.setExDate("2025-01-01"); req.setAmount(new BigDecimal("100"));

            assertThatThrownBy(() -> service.logIncome(investmentId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws when the investment belongs to another user")
        void throwsWhenNotOwned() {
            Investment inv = withId(baseInvestment().userId(UUID.randomUUID()).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            LogIncomeRequest req = new LogIncomeRequest();
            req.setIncomeType("DIVIDEND"); req.setExDate("2025-01-01"); req.setAmount(new BigDecimal("100"));

            assertThatThrownBy(() -> service.logIncome(investmentId, userId, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("is a no-op when the same investment/type/date has already been logged (dedup)")
        void dedupSkipsExistingLog() {
            Investment inv = withId(baseInvestment().symbol("TCS").build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            LogIncomeRequest req = new LogIncomeRequest();
            req.setIncomeType("DIVIDEND"); req.setExDate("2025-01-01"); req.setAmount(new BigDecimal("100"));
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    investmentId, "DIVIDEND", LocalDate.of(2025, 1, 1))).thenReturn(true);

            service.logIncome(investmentId, userId, req);

            verify(incomeRepository, never()).save(any());
            verify(incomeLogRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates an income entry and an income log row on first log")
        void createsIncomeAndLog() {
            UUID accountId = UUID.randomUUID();
            Investment inv = withId(baseInvestment().symbol("TCS").linkedAccountId(accountId).build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            LogIncomeRequest req = new LogIncomeRequest();
            req.setIncomeType("DIVIDEND"); req.setExDate("2025-01-01"); req.setAmount(new BigDecimal("100"));
            when(incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    investmentId, "DIVIDEND", LocalDate.of(2025, 1, 1))).thenReturn(false);
            com.wealthynest.domain.income.entity.IncomeEntry savedEntry =
                    com.wealthynest.domain.income.entity.IncomeEntry.builder().userId(userId).amount(new BigDecimal("100")).build();
            ReflectionTestUtils.setField(savedEntry, "id", UUID.randomUUID());
            when(incomeRepository.save(any())).thenReturn(savedEntry);

            service.logIncome(investmentId, userId, req);

            verify(incomeRepository).save(any());
            ArgumentCaptor<InvestmentIncomeLog> logCaptor = ArgumentCaptor.forClass(InvestmentIncomeLog.class);
            verify(incomeLogRepository).save(logCaptor.capture());
            assertThat(logCaptor.getValue().getIncomeEntryId()).isEqualTo(savedEntry.getId());
            assertThat(logCaptor.getValue().getAmount()).isEqualByComparingTo("100");
        }
    }

    // ─── dismissDividend ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("dismissDividend")
    class DismissDividendTests {

        @Test
        @DisplayName("throws when the investment is not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());
            DismissDividendRequest req = new DismissDividendRequest();
            ReflectionTestUtils.setField(req, "exDate", "2025-01-01");

            assertThatThrownBy(() -> service.dismissDividend(investmentId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("records a new dismissal when one doesn't already exist")
        void recordsNewDismissal() {
            Investment inv = withId(baseInvestment().build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            DismissDividendRequest req = new DismissDividendRequest();
            ReflectionTestUtils.setField(req, "exDate", "2025-01-01");
            when(dismissedDividendRepository.existsByUserIdAndInvestmentIdAndExDate(
                    userId, investmentId, LocalDate.of(2025, 1, 1))).thenReturn(false);

            service.dismissDividend(investmentId, userId, req);

            verify(dismissedDividendRepository).save(any(DismissedDividend.class));
        }

        @Test
        @DisplayName("is a no-op when the dismissal already exists")
        void skipsDuplicateDismissal() {
            Investment inv = withId(baseInvestment().build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            DismissDividendRequest req = new DismissDividendRequest();
            ReflectionTestUtils.setField(req, "exDate", "2025-01-01");
            when(dismissedDividendRepository.existsByUserIdAndInvestmentIdAndExDate(
                    userId, investmentId, LocalDate.of(2025, 1, 1))).thenReturn(true);

            service.dismissDividend(investmentId, userId, req);

            verify(dismissedDividendRepository, never()).save(any());
        }
    }

    // ─── getStockTransactions ───────────────────────────────────────────────────

    @Nested
    @DisplayName("getStockTransactions")
    class GetStockTransactionsTests {

        @Test
        @DisplayName("throws when the investment is not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getStockTransactions(investmentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("returns transactions mapped to response DTOs, ordered by transaction date")
        void returnsMappedTransactions() {
            Investment inv = withId(baseInvestment().build());
            when(investmentRepository.findById(investmentId)).thenReturn(Optional.of(inv));
            StockTransaction txn = StockTransaction.builder()
                    .investmentId(investmentId).transactionDate(LocalDate.now())
                    .transactionType("BUY").quantity(new BigDecimal("10")).pricePerShare(new BigDecimal("100"))
                    .brokerage(BigDecimal.ZERO).build();
            ReflectionTestUtils.setField(txn, "id", 7L);
            when(stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId))
                    .thenReturn(List.of(txn));

            List<StockTransactionResponse> result = service.getStockTransactions(investmentId, userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(7L);
        }
    }

    // ─── getIncomeHistory ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("getIncomeHistory")
    class IncomeHistoryTests {

        @Test
        @DisplayName("builds a credited DIVIDEND record with resolved account name and per-share amount")
        void buildsCreditedDividendRecord() {
            UUID accountId = UUID.randomUUID();
            Investment stock = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).linkedAccountId(accountId).build());
            UUID incomeEntryId = UUID.randomUUID();
            InvestmentIncomeLog log = InvestmentIncomeLog.builder()
                    .investmentId(investmentId).userId(userId).incomeEntryId(incomeEntryId)
                    .incomeType("DIVIDEND").eventDate(LocalDate.of(2025, 3, 1)).amount(new BigDecimal("50")).build();
            ReflectionTestUtils.setField(log, "id", UUID.randomUUID());

            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of(log));
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(stock));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(
                    List.of(WalletAccount.builder().name("HDFC").build()));
            com.wealthynest.domain.income.entity.IncomeEntry entry =
                    com.wealthynest.domain.income.entity.IncomeEntry.builder().accountId(accountId).build();
            when(incomeRepository.findById(incomeEntryId)).thenReturn(Optional.of(entry));
            when(corpActionRepository.findDividendsBySymbolsAndYear(anySet(), eq(2025))).thenReturn(List.of());

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            assertThat(response.getRecords()).hasSize(1);
            IncomeHistoryResponse.Record record = response.getRecords().get(0);
            assertThat(record.isCredited()).isTrue();
            assertThat(record.getPerShare()).isEqualByComparingTo("5"); // 50/10
            assertThat(response.getSummary().getDividendTotal()).isEqualByComparingTo("50");
            assertThat(response.getSummary().getGrandTotal()).isEqualByComparingTo("50");
        }

        @Test
        @DisplayName("adds a display-only historical dividend from corporate actions not yet credited")
        void addsDisplayOnlyHistoricalDividend() {
            Investment stock = withId(baseInvestment().investmentType(InvestmentType.STOCK)
                    .symbol("TCS").units(new BigDecimal("10")).purchaseDate(LocalDate.of(2024, 1, 1)).build());
            NseCorporateAction ca = NseCorporateAction.builder()
                    .symbol("TCS").exDate(LocalDate.of(2025, 2, 1)).dividendPerShare(new BigDecimal("3")).build();

            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(stock));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());
            when(corpActionRepository.findDividendsBySymbolsAndYear(eq(Set.of("TCS")), eq(2025)))
                    .thenReturn(List.of(ca));

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            assertThat(response.getRecords()).hasSize(1);
            assertThat(response.getRecords().get(0).isCredited()).isFalse();
            assertThat(response.getRecords().get(0).getAmount()).isEqualByComparingTo("30"); // 3*10
        }

        @Test
        @DisplayName("returns an empty history with zeroed totals when there is no income activity")
        void emptyHistoryWhenNoActivity() {
            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            assertThat(response.getRecords()).isEmpty();
            assertThat(response.getSummary().getGrandTotal()).isEqualByComparingTo("0");
            verifyNoInteractions(corpActionRepository);
        }

        // ── bond coupon schedule (buildCouponDates / couponPaymentsPerYear) ──────

        @Test
        @DisplayName("QUARTERLY bond: generates one display-only BOND_COUPON record per quarter in the requested year, net of TDS")
        void quarterlyBondGeneratesCouponScheduleWithTds() {
            UUID accountId = UUID.randomUUID();
            Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                    .companyName("REC Bond")
                    .couponRate(new BigDecimal("8")).couponFrequency("QUARTERLY")
                    .faceValue(new BigDecimal("1000")).units(new BigDecimal("100"))
                    .tdsRate(new BigDecimal("10")).linkedAccountId(accountId)
                    .purchaseDate(LocalDate.of(2024, 1, 15)).maturityDate(null).build());
            WalletAccount account = WalletAccount.builder().name("HDFC Bonds A/C").build();
            ReflectionTestUtils.setField(account, "id", accountId);
            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(account));

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            List<IncomeHistoryResponse.Record> bondRecords = response.getRecords().stream()
                    .filter(r -> "BOND_COUPON".equals(r.getIncomeType())).toList();
            assertThat(bondRecords).hasSize(4); // 2025-01-15, 04-15, 07-15, 10-15
            bondRecords.forEach(r -> {
                assertThat(r.getAmount()).isEqualByComparingTo("1800.00"); // 100000*8/400 * (1-0.10)
                assertThat(r.isCredited()).isFalse();
                assertThat(r.getInvestmentName()).isEqualTo("REC Bond");
                assertThat(r.getAccountName()).isEqualTo("HDFC Bonds A/C");
            });
            assertThat(response.getSummary().getBondCouponTotal()).isEqualByComparingTo("7200.00");
        }

        @Test
        @DisplayName("MONTHLY bond with no TDS: coupon credit day is clamped to each month's actual length")
        void monthlyBondClampsCreditDayAndSkipsTds() {
            Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                    .bankName("SBI").couponRate(new BigDecimal("6")).couponFrequency("MONTHLY")
                    .faceValue(new BigDecimal("1000")).units(new BigDecimal("10")).couponCreditDay(31)
                    .tdsRate(BigDecimal.ZERO).linkedAccountId(null)
                    .purchaseDate(LocalDate.of(2025, 1, 1)).maturityDate(LocalDate.of(2025, 6, 1)).build());
            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            List<IncomeHistoryResponse.Record> bondRecords = response.getRecords().stream()
                    .filter(r -> "BOND_COUPON".equals(r.getIncomeType())).toList();
            assertThat(bondRecords).extracting(IncomeHistoryResponse.Record::getEventDate)
                    .containsExactlyInAnyOrder(
                            LocalDate.of(2025, 2, 28), // Feb clamped to 28
                            LocalDate.of(2025, 3, 31),
                            LocalDate.of(2025, 4, 30), // April clamped to 30
                            LocalDate.of(2025, 5, 31),
                            LocalDate.of(2025, 6, 30)); // June clamped to 30
            bondRecords.forEach(r -> {
                assertThat(r.getAmount()).isEqualByComparingTo("50.00"); // 10000*6/1200, no TDS
                assertThat(r.getAccountName()).isNull(); // no linkedAccountId
                assertThat(r.getInvestmentName()).isEqualTo("SBI"); // falls back to bankName
            });
        }

        @Test
        @DisplayName("HALF_YEARLY and default-frequency bonds resolve to a non-empty, positive-amount coupon schedule")
        void otherFrequenciesResolve() {
            for (String freq : List.of("HALF_YEARLY", "ANNUAL")) {
                Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                        .avgBuyPrice(new BigDecimal("1000")).units(new BigDecimal("10"))
                        .couponRate(new BigDecimal("6")).couponFrequency(freq).faceValue(null)
                        .purchaseDate(LocalDate.of(2023, 1, 1)).maturityDate(LocalDate.of(2025, 12, 31)).build());
                when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
                when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
                when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

                List<IncomeHistoryResponse.Record> bondRecords = service.getIncomeHistory(userId, 2025)
                        .getRecords().stream().filter(r -> "BOND_COUPON".equals(r.getIncomeType())).toList();

                assertThat(bondRecords).isNotEmpty();
                bondRecords.forEach(r -> assertThat(r.getAmount()).isGreaterThan(BigDecimal.ZERO));
            }
        }

        @Test
        @DisplayName("a bond missing couponFrequency is skipped entirely, contributing no coupon records")
        void bondMissingFrequencyIsSkipped() {
            Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                    .couponRate(new BigDecimal("6")).couponFrequency(null)
                    .purchaseDate(LocalDate.of(2024, 1, 1)).build());
            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            assertThat(response.getRecords()).isEmpty();
        }

        @Test
        @DisplayName("a bond coupon date already present in the credited income log is not duplicated as display-only")
        void alreadyCreditedCouponDateIsDeduped() {
            Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                    .couponRate(new BigDecimal("8")).couponFrequency("QUARTERLY")
                    .faceValue(new BigDecimal("1000")).units(new BigDecimal("100")).tdsRate(BigDecimal.ZERO)
                    .purchaseDate(LocalDate.of(2024, 1, 15)).maturityDate(null).build());
            InvestmentIncomeLog creditedLog = InvestmentIncomeLog.builder()
                    .investmentId(investmentId).userId(userId).incomeType("BOND_COUPON")
                    .eventDate(LocalDate.of(2025, 4, 15)).amount(new BigDecimal("2000")).build();
            ReflectionTestUtils.setField(creditedLog, "id", UUID.randomUUID());
            when(incomeLogRepository.findByUserIdAndYear(userId, 2025)).thenReturn(List.of(creditedLog));
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2025);

            List<IncomeHistoryResponse.Record> bondCouponDisplayOnly = response.getRecords().stream()
                    .filter(r -> "BOND_COUPON".equals(r.getIncomeType()) && !r.isCredited()).toList();
            // The already-credited 2025-04-15 date must not also appear as a display-only duplicate.
            assertThat(bondCouponDisplayOnly).extracting(IncomeHistoryResponse.Record::getEventDate)
                    .doesNotContain(LocalDate.of(2025, 4, 15));
            assertThat(response.getRecords()).filteredOn(r -> "BOND_COUPON".equals(r.getIncomeType())).hasSize(4); // 1 credited + 3 display-only
        }

        @Test
        @DisplayName("coupon dates outside the requested year or in the future are excluded from the schedule")
        void couponDatesOutsideRequestedYearOrInFutureAreExcluded() {
            Investment bond = withId(baseInvestment().investmentType(InvestmentType.BOND)
                    .couponRate(new BigDecimal("8")).couponFrequency("QUARTERLY")
                    .faceValue(new BigDecimal("1000")).units(new BigDecimal("100")).tdsRate(BigDecimal.ZERO)
                    .purchaseDate(LocalDate.of(2024, 1, 15)).maturityDate(null).build());
            when(incomeLogRepository.findByUserIdAndYear(userId, 2024)).thenReturn(List.of());
            when(investmentRepository.findByUserId(userId)).thenReturn(List.of(bond));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());

            // Requesting 2024 excludes every 2025+ coupon date, even though they were also generated
            // by buildCouponDates() for this same bond.
            IncomeHistoryResponse response = service.getIncomeHistory(userId, 2024);

            assertThat(response.getRecords()).allSatisfy(r ->
                    assertThat(r.getEventDate().getYear()).isEqualTo(2024));
        }
    }
}
