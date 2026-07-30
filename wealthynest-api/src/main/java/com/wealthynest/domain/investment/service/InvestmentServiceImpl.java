package com.wealthynest.domain.investment.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.dto.request.*;
import com.wealthynest.domain.investment.dto.response.*;
import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import com.wealthynest.infra.util.XirrCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvestmentServiceImpl implements InvestmentService {

    // Marks a StockTransaction that was backfilled from an investment's pre-ledger units/
    // avgBuyPrice (added before Buy More/Sell tracking existed) rather than one the user actually
    // logged via the transaction modal. Reuses the existing `notes` column instead of a new
    // boolean/migration for a single cosmetic flag — the frontend checks for this exact string to
    // label the row "Opening position" instead of a plain Buy.
    private static final String SEED_TXN_NOTE = "Opening position (auto-recorded)";

    private final InvestmentRepository          investmentRepository;
    private final AssetRepository               assetRepository;
    private final StockPriceCacheRepository     stockPriceCacheRepository;
    private final GoldPriceCacheRepository      goldPriceCacheRepository;
    private final MFNavCacheRepository          mfNavCacheRepository;
    private final StockMasterRepository         stockMasterRepository;
    private final MfMasterRepository            mfMasterRepository;
    private final SipTransactionRepository      sipTransactionRepository;
    private final NseCorporateActionRepository  corpActionRepository;
    private final InvestmentIncomeLogRepository incomeLogRepository;
    private final WalletAccountRepository       accountRepository;
    private final AccountOwnershipGuard         accountOwnershipGuard;
    private final AccountTransferRepository     accountTransferRepository;
    private final IncomeRepository              incomeRepository;
    private final ExternalPriceService          externalPriceService;
    private final AutoIncomeScheduler           autoIncomeScheduler;
    private final DismissedDividendRepository   dismissedDividendRepository;
    private final StockTransactionRepository    stockTransactionRepository;

    @Override @Transactional
    public InvestmentResponse createInvestment(UUID userId, CreateInvestmentRequest req) {
        // For stocks: merge into the existing holding row instead of creating a duplicate.
        // All buy lots are tracked as StockTransactions; WAC is recalculated from them.
        if (req.getInvestmentType() == InvestmentType.STOCK && req.getSymbol() != null
                && req.getUnits() != null && req.getUnits().compareTo(BigDecimal.ZERO) > 0
                && req.getAvgBuyPrice() != null) {
            Optional<Investment> existing = investmentRepository
                .findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(
                    userId, req.getSymbol(), InvestmentType.STOCK);
            if (existing.isPresent()) {
                Investment inv = existing.get();
                // Seed initial transaction if not yet tracked
                if (stockTransactionRepository.countByInvestmentId(inv.getId()) == 0
                        && inv.getUnits() != null && inv.getUnits().compareTo(BigDecimal.ZERO) > 0
                        && inv.getAvgBuyPrice() != null) {
                    stockTransactionRepository.save(StockTransaction.builder()
                        .investmentId(inv.getId())
                        .transactionDate(inv.getPurchaseDate() != null ? inv.getPurchaseDate() : LocalDate.now())
                        .transactionType("BUY")
                        .quantity(inv.getUnits())
                        .pricePerShare(inv.getAvgBuyPrice())
                        .brokerage(inv.getBrokerage() != null ? inv.getBrokerage() : BigDecimal.ZERO)
                        .notes(SEED_TXN_NOTE)
                        .build());
                }
                // Record the new buy lot
                BigDecimal brokerage = req.getBrokerage() != null ? req.getBrokerage() : BigDecimal.ZERO;
                stockTransactionRepository.save(StockTransaction.builder()
                    .investmentId(inv.getId())
                    .transactionDate(req.getPurchaseDate() != null ? req.getPurchaseDate() : LocalDate.now())
                    .transactionType("BUY")
                    .quantity(req.getUnits())
                    .pricePerShare(req.getAvgBuyPrice())
                    .brokerage(brokerage)
                    .notes(req.getNotes())
                    .build());
                // Debit source account if specified
                if (req.getDebitAccountId() != null) {
                    accountOwnershipGuard.validateAccountOwnership(req.getDebitAccountId(), userId);
                    BigDecimal cost = req.getUnits().multiply(req.getAvgBuyPrice()).add(brokerage);
                    accountTransferRepository.save(AccountTransfer.builder()
                        .userId(userId)
                        .fromAccountId(req.getDebitAccountId())
                        .toAccountId(null)
                        .amount(cost)
                        .transferDate(req.getPurchaseDate() != null ? req.getPurchaseDate() : LocalDate.now())
                        .description("Buy " + req.getSymbol() + " ×" + req.getUnits())
                        .build());
                }
                recalculateStockTotals(inv, req.getAvgBuyPrice());
                return enrich(inv);
            }
        }

        accountOwnershipGuard.validateAccountOwnership(req.getLinkedAccountId(), userId);
        accountOwnershipGuard.validateAccountOwnership(req.getDebitAccountId(), userId);

        // Auto-create linked asset
        UUID assetId = req.getAssetId();
        if (assetId != null) {
            // Otherwise a caller could point a new investment at someone else's asset —
            // every later update would then overwrite that asset's real value (IDOR write).
            UUID requestedAssetId = assetId;
            assetRepository.findByIdAndUserId(requestedAssetId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Asset", "id", requestedAssetId));
        }
        if (assetId == null) {
            String name = nameFor(req);
            Asset asset = Asset.builder()
                .userId(userId).name(name)
                .assetType(mapToAssetType(req.getInvestmentType()))
                .currentValue(computeCurrentValue(req))
                .currency("INR").active(true).asOfDate(LocalDate.now()).build();
            assetId = assetRepository.save(asset).getId();
        }

        Investment inv = Investment.builder()
            .userId(userId).assetId(assetId)
            .investmentType(req.getInvestmentType())
            .symbol(req.getSymbol()).exchange(req.getExchange() != null ? req.getExchange() : "NSE")
            .schemeCode(req.getSchemeCode()).companyName(req.getCompanyName())
            .units(req.getUnits()).avgBuyPrice(req.getAvgBuyPrice())
            .currentPrice(req.getCurrentPrice())
            .investedAmount(req.getInvestedAmount())
            .currentValue(computeCurrentValue(req))
            .sipAmount(req.getSipAmount()).sipDay(req.getSipDay())
            .purchaseDate(req.getPurchaseDate())
            .faceValue(req.getFaceValue())
            .couponRate(req.getCouponRate()).couponFrequency(req.getCouponFrequency())
            .couponCreditDay(req.getCouponCreditDay())
            .maturityDate(req.getMaturityDate()).bankName(req.getBankName())
            .compoundingFrequency(req.getCompoundingFrequency())
            .quantityGrams(req.getQuantityGrams())
            .goldKarat(req.getGoldKarat() != null ? req.getGoldKarat() : 22)
            .linkedAccountId(req.getLinkedAccountId())
            .tdsRate(req.getTdsRate() != null ? req.getTdsRate() : BigDecimal.ZERO)
            .brokerage(req.getBrokerage() != null ? req.getBrokerage() : BigDecimal.ZERO)
            .notes(req.getNotes()).active(true).build();

        Investment saved = investmentRepository.save(inv);

        // Create a debit transfer if a source account was specified (toAccountId null = investment has no real destination)
        if (req.getDebitAccountId() != null) {
            // Debit = investedAmount + brokerage (brokerage is a cost on top of the investment)
            BigDecimal brokerageAmt = req.getBrokerage() != null ? req.getBrokerage() : BigDecimal.ZERO;
            BigDecimal debitAmt = req.getInvestedAmount().add(brokerageAmt);
            AccountTransfer debitTransfer = AccountTransfer.builder()
                .userId(userId)
                .fromAccountId(req.getDebitAccountId())
                .toAccountId(null)
                .amount(debitAmt)
                .transferDate(req.getPurchaseDate() != null ? req.getPurchaseDate() : LocalDate.now())
                .description("Investment: " + nameFor(req))
                .build();
            AccountTransfer savedTransfer = accountTransferRepository.save(debitTransfer);
            saved.setDebitTransferId(savedTransfer.getId());
            saved.setDebitAccountId(req.getDebitAccountId());
            investmentRepository.save(saved);
        }

        // Seed the initial BUY transaction for stocks so sell/buy-more recalculations work correctly
        if (saved.getInvestmentType() == InvestmentType.STOCK
                && saved.getUnits() != null && saved.getUnits().compareTo(BigDecimal.ZERO) > 0
                && saved.getAvgBuyPrice() != null) {
            stockTransactionRepository.save(StockTransaction.builder()
                .investmentId(saved.getId())
                .transactionDate(saved.getPurchaseDate() != null ? saved.getPurchaseDate() : LocalDate.now())
                .transactionType("BUY")
                .quantity(saved.getUnits())
                .pricePerShare(saved.getAvgBuyPrice())
                .brokerage(saved.getBrokerage() != null ? saved.getBrokerage() : BigDecimal.ZERO)
                .notes(SEED_TXN_NOTE)
                .build());
        }

        // Register after-commit hook so backfill runs only after the investment row is visible in DB.
        // backfill methods are @Async — they return immediately and run in a thread pool.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                if (saved.getInvestmentType() == InvestmentType.STOCK && saved.getSymbol() != null) {
                    autoIncomeScheduler.backfillDividendsForStock(saved);
                } else if (saved.getInvestmentType() == InvestmentType.BOND) {
                    autoIncomeScheduler.backfillBondCoupons(saved);
                } else if (saved.getInvestmentType() == InvestmentType.FD) {
                    autoIncomeScheduler.backfillFDMaturity(saved);
                }
            }
        });

        return enrich(saved);
    }

    @Override @Transactional
    public InvestmentResponse updateInvestment(UUID id, UUID userId, CreateInvestmentRequest req) {
        Investment inv = findAndValidate(id, userId);
        UUID oldLinkedAccountId = inv.getLinkedAccountId();
        accountOwnershipGuard.validateAccountOwnership(req.getLinkedAccountId(), userId);

        boolean isStock = inv.getInvestmentType() == InvestmentType.STOCK;

        // For non-stock types, sync the debit transfer amount if investedAmount changed
        if (!isStock && inv.getDebitTransferId() != null && req.getInvestedAmount() != null
                && req.getInvestedAmount().compareTo(inv.getInvestedAmount()) != 0) {
            accountTransferRepository.findById(inv.getDebitTransferId()).ifPresent(t -> {
                t.setAmount(req.getInvestedAmount());
                accountTransferRepository.save(t);
            });
        }

        inv.setInvestmentType(req.getInvestmentType());

        // Guard: if a stock's symbol is being changed to one already held in another active row,
        // block it — the user should use "Add transaction" on the existing holding instead.
        if (isStock && req.getSymbol() != null
                && !req.getSymbol().equalsIgnoreCase(inv.getSymbol())) {
            investmentRepository
                .findByUserIdAndSymbolAndInvestmentTypeAndActiveTrue(userId, req.getSymbol(), InvestmentType.STOCK)
                .ifPresent(other -> {
                    if (!other.getId().equals(id))
                        throw new IllegalArgumentException(
                            "You already have an active holding for " + req.getSymbol() +
                            ". Add a buy transaction to that position instead of creating a duplicate.");
                });
        }

        inv.setSymbol(req.getSymbol());
        inv.setExchange(req.getExchange() != null ? req.getExchange() : "NSE");
        inv.setSchemeCode(req.getSchemeCode());
        inv.setCompanyName(req.getCompanyName());
        inv.setGoldKarat(req.getGoldKarat() != null ? req.getGoldKarat() : inv.getGoldKarat());
        inv.setSipAmount(req.getSipAmount());
        inv.setSipDay(req.getSipDay());
        inv.setPurchaseDate(req.getPurchaseDate());
        inv.setFaceValue(req.getFaceValue());
        inv.setCouponRate(req.getCouponRate());
        inv.setCouponFrequency(req.getCouponFrequency());
        inv.setCouponCreditDay(req.getCouponCreditDay());
        inv.setMaturityDate(req.getMaturityDate());
        inv.setBankName(req.getBankName());
        inv.setCompoundingFrequency(req.getCompoundingFrequency());
        inv.setQuantityGrams(req.getQuantityGrams());
        inv.setLinkedAccountId(req.getLinkedAccountId());
        inv.setTdsRate(req.getTdsRate() != null ? req.getTdsRate() : BigDecimal.ZERO);
        inv.setNotes(req.getNotes());

        if (isStock) {
            investmentRepository.save(inv); // save metadata first so ID is available

            List<StockTransaction> txns =
                stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(id);
            // Units/avg price are only a free-form "correct my initial buy" field while the seed
            // transaction is the ONLY transaction on record. Once a Buy More/Sell has happened,
            // units/avgBuyPrice are derived from the full ledger (see recalculateStockTotals) —
            // applying the edit form's (already-aggregate) values on top of that would double
            // count the seed against the other transactions still in the ledger.
            if (txns.size() <= 1 && req.getUnits() != null
                    && req.getUnits().compareTo(BigDecimal.ZERO) > 0 && req.getAvgBuyPrice() != null) {
                StockTransaction seed = txns.stream()
                    .filter(t -> "BUY".equals(t.getTransactionType()))
                    .findFirst().orElse(null);
                if (seed != null) {
                    seed.setQuantity(req.getUnits());
                    seed.setPricePerShare(req.getAvgBuyPrice());
                    if (inv.getPurchaseDate() != null) seed.setTransactionDate(inv.getPurchaseDate());
                    stockTransactionRepository.save(seed);
                } else {
                    stockTransactionRepository.save(StockTransaction.builder()
                        .investmentId(id)
                        .transactionDate(inv.getPurchaseDate() != null ? inv.getPurchaseDate() : LocalDate.now())
                        .transactionType("BUY")
                        .quantity(req.getUnits())
                        .pricePerShare(req.getAvgBuyPrice())
                        .brokerage(inv.getBrokerage() != null ? inv.getBrokerage() : BigDecimal.ZERO)
                        .notes(SEED_TXN_NOTE)
                        .build());
                }
            }
            recalculateStockTotals(inv, null);
        } else {
            // Non-stock: apply financial values from request directly
            inv.setUnits(req.getUnits());
            inv.setAvgBuyPrice(req.getAvgBuyPrice());
            inv.setCurrentPrice(req.getCurrentPrice());
            inv.setInvestedAmount(req.getInvestedAmount());
            inv.setCurrentValue(computeCurrentValue(req));
            inv.setBrokerage(req.getBrokerage() != null ? req.getBrokerage() : BigDecimal.ZERO);
        }

        assetRepository.findById(inv.getAssetId()).ifPresent(a -> {
            a.setCurrentValue(inv.getCurrentValue());
            a.setAsOfDate(LocalDate.now());
            assetRepository.save(a);
        });
        Investment saved = investmentRepository.save(inv);

        // When the auto-credit account changes, move existing income entries to the new account
        UUID newLinkedAccountId = req.getLinkedAccountId();
        if (oldLinkedAccountId != null && newLinkedAccountId != null
                && !oldLinkedAccountId.equals(newLinkedAccountId)) {
            incomeLogRepository.findByInvestmentId(saved.getId()).forEach(log -> {
                if (log.getIncomeEntryId() != null) {
                    incomeRepository.findById(log.getIncomeEntryId()).ifPresent(entry -> {
                        if (oldLinkedAccountId.equals(entry.getAccountId())) {
                            entry.setAccountId(newLinkedAccountId);
                            incomeRepository.save(entry);
                        }
                    });
                }
            });
        }

        return enrich(saved);
    }

    @Override @Transactional
    public void deleteInvestment(UUID id, UUID userId) {
        Investment inv = findAndValidate(id, userId);
        if (inv.getDebitTransferId() != null) {
            accountTransferRepository.deleteById(inv.getDebitTransferId());
            inv.setDebitTransferId(null);
            inv.setDebitAccountId(null);
        }
        inv.setActive(false);
        investmentRepository.save(inv);

        // Deactivate the linked asset when no other active investment still references it
        UUID assetId = inv.getAssetId();
        if (assetId != null && !investmentRepository.existsByAssetIdAndActiveTrueAndIdNot(assetId, id)) {
            assetRepository.findById(assetId).ifPresent(a -> {
                a.setActive(false);
                assetRepository.save(a);
            });
        }
    }

    @Override @Transactional(readOnly = true)
    public List<InvestmentResponse> getInvestments(UUID userId) {
        return enrichAll(investmentRepository.findByUserIdAndActiveTrue(userId));
    }

    @Override
    public List<InvestmentSearchResult> searchStocks(String query) {
        if (query == null || query.isBlank()) return List.of();
        String q = query.trim();

        // 1. Search local NSE master DB (and BSE-only records we may have seeded)
        List<InvestmentSearchResult> dbResults = stockMasterRepository.search(q, Pageable.ofSize(15)).stream()
            .map(s -> InvestmentSearchResult.builder()
                .symbol(s.getSymbol()).name(s.getCompanyName())
                .exchange(s.getExchange()).type("STOCK").build())
            .collect(Collectors.toCollection(ArrayList::new));

        // Collect NSE symbols already in DB results for deduplication
        Set<String> nseSymbols = dbResults.stream()
            .filter(r -> "NSE".equals(r.getExchange()))
            .map(r -> r.getSymbol().toLowerCase())
            .collect(Collectors.toSet());

        // 2. Supplement with BSE stocks from Yahoo Finance — only include those not already on NSE
        List<InvestmentSearchResult> bseYahoo = externalPriceService.searchBSEStocks(q);
        for (InvestmentSearchResult bse : bseYahoo) {
            if (!nseSymbols.contains(bse.getSymbol().toLowerCase())
                    && dbResults.stream().noneMatch(r -> r.getSymbol().equalsIgnoreCase(bse.getSymbol())
                        && "BSE".equals(r.getExchange()))) {
                dbResults.add(bse);
            }
        }

        // Cap at 20 results, NSE first (already ordered by DB query)
        return dbResults.size() > 20 ? dbResults.subList(0, 20) : dbResults;
    }

    @Override
    public List<InvestmentSearchResult> searchMF(String query) {
        if (query == null || query.isBlank()) return List.of();
        // Local mf_master lookup instead of proxying live to mfapi.in on every keystroke — see
        // MfMasterSyncScheduler for how the table stays current.
        return mfMasterRepository.search(query.trim(), Pageable.ofSize(15)).stream()
            .map(m -> InvestmentSearchResult.builder()
                .schemeCode(m.getSchemeCode()).name(m.getSchemeName()).type("MF").build())
            .toList();
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal getGoldPrice22k() {
        return goldPriceCacheRepository.findById(1)
            .map(GoldPriceCache::getPrice22kPerGram)
            .orElseGet(externalPriceService::fetchGoldPrice22k);
    }

    @Override @Transactional(readOnly = true)
    public java.util.Map<String, BigDecimal> getGoldPriceAllKarats() {
        return goldPriceCacheRepository.findById(1)
            .map(c -> {
                BigDecimal p24 = c.getPrice24kPerGram();
                BigDecimal p22 = c.getPrice22kPerGram();
                // Derive missing karats from price24k so a stale-column cache never returns 0
                if (p24 == null && p22 != null)
                    p24 = p22.multiply(BigDecimal.valueOf(24)).divide(BigDecimal.valueOf(22), 2, RoundingMode.HALF_UP);
                BigDecimal p18 = c.getPrice18kPerGram() != null ? c.getPrice18kPerGram()
                    : p24 != null ? p24.multiply(BigDecimal.valueOf(18)).divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
                return java.util.Map.of(
                    "price18k", p18,
                    "price22k", p22 != null ? p22 : BigDecimal.ZERO,
                    "price24k", p24 != null ? p24 : BigDecimal.ZERO
                );
            })
            .orElseGet(() -> {
                ExternalPriceService.GoldPriceData d = externalPriceService.fetchGoldPriceData();
                if (d == null) return java.util.Map.of();
                return java.util.Map.of(
                    "price18k", d.price18k() != null ? d.price18k() : BigDecimal.ZERO,
                    "price22k", d.price22k() != null ? d.price22k() : BigDecimal.ZERO,
                    "price24k", d.price24k() != null ? d.price24k() : BigDecimal.ZERO
                );
            });
    }

    @Override @Transactional(readOnly = true)
    public java.util.Map<String, Object> getGoldPriceInfo() {
        return goldPriceCacheRepository.findById(1)
            .map(c -> {
                BigDecimal p24 = c.getPrice24kPerGram();
                BigDecimal p22 = c.getPrice22kPerGram();
                if (p24 == null && p22 != null)
                    p24 = p22.multiply(BigDecimal.valueOf(24)).divide(BigDecimal.valueOf(22), 2, RoundingMode.HALF_UP);
                BigDecimal p18 = c.getPrice18kPerGram() != null ? c.getPrice18kPerGram()
                    : p24 != null ? p24.multiply(BigDecimal.valueOf(18)).divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
                java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("price18k", p18);
                m.put("price22k", p22 != null ? p22 : BigDecimal.ZERO);
                m.put("price24k", p24 != null ? p24 : BigDecimal.ZERO);
                m.put("lastUpdated", c.getLastUpdated() != null ? c.getLastUpdated().toString() : null);
                return m;
            })
            .orElseGet(() -> {
                ExternalPriceService.GoldPriceData d = externalPriceService.fetchGoldPriceData();
                java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                if (d != null) {
                    m.put("price18k", d.price18k() != null ? d.price18k() : BigDecimal.ZERO);
                    m.put("price22k", d.price22k() != null ? d.price22k() : BigDecimal.ZERO);
                    m.put("price24k", d.price24k() != null ? d.price24k() : BigDecimal.ZERO);
                }
                m.put("lastUpdated", null);
                return m;
            });
    }

    @Override @Transactional
    public void logIncome(UUID investmentId, UUID userId, LogIncomeRequest req) {
        Investment inv = investmentRepository.findById(investmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", investmentId));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException("Not your investment");

        LocalDate date = LocalDate.parse(req.getExDate());

        // Dedup: skip if already logged for this investment + type + date
        boolean exists = incomeLogRepository
            .existsByInvestmentIdAndIncomeTypeAndEventDate(investmentId, req.getIncomeType(), date);
        if (exists) return;

        IncomeEntry entry = IncomeEntry.builder()
            .userId(userId)
            .accountId(inv.getLinkedAccountId())
            .source(IncomeSource.DIVIDEND)
            .paymentMode(IncomePaymentMode.BANK_ACCOUNT)
            .amount(req.getAmount())
            .description("Dividend – " + (inv.getSymbol() != null ? inv.getSymbol() : inv.getCompanyName()))
            .incomeDate(date)
            .periodMonth(date.getMonthValue())
            .periodYear(date.getYear())
            .build();
        entry = incomeRepository.save(entry);

        incomeLogRepository.save(InvestmentIncomeLog.builder()
            .investmentId(investmentId)
            .userId(userId)
            .incomeEntryId(entry.getId())
            .incomeType(req.getIncomeType())
            .eventDate(date)
            .amount(req.getAmount())
            // Captured server-side from the authoritative current holding, not trusted from the
            // request — see the entity field's own comment. Same value getDividendSuggestions
            // itself just used to compute this suggestion moments earlier, so this is never
            // meaningfully staler than what the user actually saw on screen.
            .sharesHeld(inv.getUnits())
            .build());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Batched variant of {@link #enrich(Investment)} for a whole-portfolio list response — the
     * per-row debit-account name lookup and per-row stock-transaction count that {@code enrich}
     * does individually are each pre-fetched here as one grouped query, so a portfolio of N
     * investments costs 2 extra queries total instead of up to 2N. */
    private List<InvestmentResponse> enrichAll(List<Investment> investments) {
        if (investments.isEmpty()) return List.of();

        List<UUID> debitAccountIds = investments.stream()
            .map(Investment::getDebitAccountId).filter(java.util.Objects::nonNull).distinct().toList();
        Map<UUID, String> accountNames = debitAccountIds.isEmpty() ? Map.of()
            : accountRepository.findAllById(debitAccountIds).stream()
                .collect(java.util.stream.Collectors.toMap(a -> a.getId(), a -> a.getName()));

        List<UUID> stockIds = investments.stream()
            .filter(i -> i.getInvestmentType() == InvestmentType.STOCK).map(Investment::getId).toList();
        Map<UUID, Long> stockTxnCounts = stockIds.isEmpty() ? Map.of()
            : stockTransactionRepository.countByInvestmentIdIn(stockIds).stream()
                .collect(java.util.stream.Collectors.toMap(row -> (UUID) row[0], row -> (Long) row[1]));

        return investments.stream().map(inv -> enrich(inv, accountNames, stockTxnCounts)).toList();
    }

    private InvestmentResponse enrich(Investment inv) {
        return enrich(inv, null, null);
    }

    private InvestmentResponse enrich(Investment inv, Map<UUID, String> accountNameCache, Map<UUID, Long> stockTxnCountCache) {
        BigDecimal currentVal = inv.getCurrentValue();
        BigDecimal livePrice  = null;
        BigDecimal dayChange  = null, dayChangePct = null, w52h = null, w52l = null;
        BigDecimal maturityAmt = null, accruedInterest = null;
        java.time.Instant priceLastUpdated = null;

        // Overlay live cache prices
        if (inv.getInvestmentType() == InvestmentType.STOCK && inv.getSymbol() != null) {
            StockPriceCache cache = stockPriceCacheRepository.findById(inv.getSymbol()).orElse(null);
            if (cache != null && cache.getCurrentPrice() != null) {
                livePrice = cache.getCurrentPrice();
                if (inv.getUnits() != null) currentVal = inv.getUnits().multiply(livePrice);
                dayChange       = cache.getDayChange();
                dayChangePct    = cache.getDayChangePct();
                w52h            = cache.getWeek52High();
                w52l            = cache.getWeek52Low();
                priceLastUpdated = cache.getLastUpdated();
            }
        } else if (inv.getInvestmentType() == InvestmentType.MUTUAL_FUND && inv.getSchemeCode() != null) {
            MFNavCache cache = mfNavCacheRepository.findById(inv.getSchemeCode()).orElse(null);
            if (cache != null && cache.getNav() != null) {
                livePrice = cache.getNav();
                if (inv.getUnits() != null) currentVal = inv.getUnits().multiply(livePrice);
                priceLastUpdated = cache.getLastUpdated();
            }
        } else if (inv.getInvestmentType() == InvestmentType.GOLD
                || inv.getInvestmentType() == InvestmentType.GOLD_ETF) {
            GoldPriceCache gc = goldPriceCacheRepository.findById(1).orElse(null);
            if (gc != null) {
                int karat = inv.getGoldKarat() != null ? inv.getGoldKarat() : 22;
                BigDecimal p24 = gc.getPrice24kPerGram();
                livePrice = switch (karat) {
                    case 24 -> p24;
                    case 18 -> gc.getPrice18kPerGram() != null ? gc.getPrice18kPerGram()
                               : p24 != null ? p24.multiply(BigDecimal.valueOf(18)).divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP) : null;
                    default -> gc.getPrice22kPerGram();
                };
                if (livePrice == null) livePrice = gc.getPrice22kPerGram(); // last resort
                if (livePrice != null && inv.getQuantityGrams() != null)
                    currentVal = inv.getQuantityGrams().multiply(livePrice).setScale(2, RoundingMode.HALF_UP);
                priceLastUpdated = gc.getLastUpdated();
            }
        } else if (inv.getInvestmentType() == InvestmentType.FD && inv.getCouponRate() != null) {
            maturityAmt     = computeFDMaturity(inv);
            accruedInterest = computeFDAccrued(inv);
            // Include accrued interest in currentVal so gain/loss and overview totals are accurate
            if (accruedInterest != null)
                currentVal = inv.getInvestedAmount().add(accruedInterest);
        } else if (inv.getInvestmentType() == InvestmentType.BOND && inv.getCouponRate() != null) {
            // Maturity principal = face value × units (what the bondholder receives at maturity,
            // independent of the purchase price which may be at discount or premium).
            BigDecimal fv = inv.getFaceValue() != null ? inv.getFaceValue() : inv.getAvgBuyPrice();
            if (fv != null && inv.getUnits() != null)
                maturityAmt = fv.multiply(inv.getUnits()).setScale(2, RoundingMode.HALF_UP);
            accruedInterest = computeBondAccrued(inv);
            if (accruedInterest != null)
                currentVal = inv.getInvestedAmount().add(accruedInterest);
        }

        BigDecimal gainLoss = currentVal.subtract(inv.getInvestedAmount());
        double gainLossPct  = inv.getInvestedAmount().compareTo(BigDecimal.ZERO) > 0
            ? gainLoss.divide(inv.getInvestedAmount(), 4, RoundingMode.HALF_UP)
                      .multiply(BigDecimal.valueOf(100)).doubleValue() : 0.0;

        String debitAccountName = null;
        if (inv.getDebitAccountId() != null) {
            debitAccountName = accountNameCache != null
                ? accountNameCache.get(inv.getDebitAccountId())
                : accountRepository.findById(inv.getDebitAccountId()).map(a -> a.getName()).orElse(null);
        }

        return InvestmentResponse.builder()
            .id(inv.getId()).assetId(inv.getAssetId())
            .investmentType(inv.getInvestmentType().name())
            .symbol(inv.getSymbol()).exchange(inv.getExchange())
            .schemeCode(inv.getSchemeCode()).companyName(inv.getCompanyName())
            .units(inv.getUnits()).avgBuyPrice(inv.getAvgBuyPrice())
            .currentPrice(inv.getCurrentPrice()).livePrice(livePrice)
            .investedAmount(inv.getInvestedAmount()).currentValue(currentVal)
            .gainLoss(gainLoss).gainLossPct(gainLossPct)
            .sipAmount(inv.getSipAmount()).sipDay(inv.getSipDay())
            .nextSipDate(computeNextSipDate(inv))
            .purchaseDate(inv.getPurchaseDate())
            .faceValue(inv.getFaceValue())
            .couponRate(inv.getCouponRate()).couponFrequency(inv.getCouponFrequency())
            .couponCreditDay(inv.getCouponCreditDay())
            .maturityDate(inv.getMaturityDate()).bankName(inv.getBankName())
            .compoundingFrequency(inv.getCompoundingFrequency())
            .quantityGrams(inv.getQuantityGrams())
            .goldKarat(inv.getGoldKarat() != null ? inv.getGoldKarat() : 22)
            .maturityAmount(maturityAmt).accruedInterest(accruedInterest)
            .linkedAccountId(inv.getLinkedAccountId())
            .debitAccountId(inv.getDebitAccountId())
            .debitAccountName(debitAccountName)
            .tdsRate(inv.getTdsRate())
            .brokerage(inv.getBrokerage())
            .notes(inv.getNotes())
            .active(inv.isActive()).createdAt(inv.getCreatedAt())
            .dayChange(dayChange).dayChangePct(dayChangePct)
            .week52High(w52h).week52Low(w52l)
            .priceLastUpdated(priceLastUpdated)
            .transactionCount(inv.getInvestmentType() == InvestmentType.STOCK
                    ? (stockTxnCountCache != null
                        ? stockTxnCountCache.getOrDefault(inv.getId(), 0L).intValue()
                        : (int) stockTransactionRepository.countByInvestmentId(inv.getId()))
                    : 0)
            .build();
    }

    private BigDecimal computeCurrentValue(CreateInvestmentRequest req) {
        if (req.getUnits() != null && req.getCurrentPrice() != null)
            return req.getUnits().multiply(req.getCurrentPrice()).setScale(2, RoundingMode.HALF_UP);
        if (req.getQuantityGrams() != null && req.getCurrentPrice() != null)
            return req.getQuantityGrams().multiply(req.getCurrentPrice()).setScale(2, RoundingMode.HALF_UP);
        return req.getCurrentValue();
    }

    /** The next occurrence of this investment's SIP day on or after today — rolls into next month
     *  once this month's (clamped) SIP date has already passed. Null when sipDay isn't set at all. */
    private LocalDate computeNextSipDate(Investment inv) {
        // Defensive beyond CreateInvestmentRequest's own @Min(1)@Max(31) — an unstubbed mock (or
        // any future path that doesn't go through validation) can leave this at 0, which
        // LocalDate.of would otherwise reject with a DateTimeException.
        if (inv.getSipDay() == null || inv.getSipDay() < 1 || inv.getSipDay() > 31) return null;
        LocalDate today = LocalDate.now();
        LocalDate thisMonth = clampedSipDate(today.getYear(), today.getMonthValue(), inv.getSipDay());
        if (!thisMonth.isBefore(today)) return thisMonth;
        LocalDate next = today.plusMonths(1);
        return clampedSipDate(next.getYear(), next.getMonthValue(), inv.getSipDay());
    }

    private LocalDate clampedSipDate(int year, int month, int day) {
        int lastDay = YearMonth.of(year, month).lengthOfMonth();
        return LocalDate.of(year, month, Math.min(day, lastDay));
    }

    private BigDecimal computeFDMaturity(Investment fd) {
        if (fd.getCouponRate() == null || fd.getPurchaseDate() == null || fd.getMaturityDate() == null)
            return null;
        BigDecimal principal = fd.getInvestedAmount();
        BigDecimal rate = fd.getCouponRate().divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP);
        long days = ChronoUnit.DAYS.between(fd.getPurchaseDate(), fd.getMaturityDate());
        String freq = fd.getCompoundingFrequency() != null ? fd.getCompoundingFrequency() : "QUARTERLY";
        if ("SIMPLE".equalsIgnoreCase(freq)) {
            BigDecimal interest = principal.multiply(rate)
                .multiply(BigDecimal.valueOf(days)).divide(BigDecimal.valueOf(365), 2, RoundingMode.HALF_UP);
            return principal.add(interest);
        }
        int n = switch (freq.toUpperCase()) {
            case "MONTHLY" -> 12; case "QUARTERLY" -> 4; case "HALF_YEARLY" -> 2; default -> 1;
        };
        double t = days / 365.0;
        double maturity = principal.doubleValue() * Math.pow(1 + rate.doubleValue() / n, n * t);
        return BigDecimal.valueOf(maturity).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal computeFDAccrued(Investment fd) {
        if (fd.getPurchaseDate() == null) return null;
        LocalDate to = LocalDate.now().isBefore(fd.getMaturityDate() != null ? fd.getMaturityDate() : LocalDate.now())
            ? LocalDate.now() : fd.getMaturityDate();
        Investment clone = Investment.builder()
            .investedAmount(fd.getInvestedAmount()).couponRate(fd.getCouponRate())
            .purchaseDate(fd.getPurchaseDate()).maturityDate(to)
            .compoundingFrequency(fd.getCompoundingFrequency()).build();
        BigDecimal mat = computeFDMaturity(clone);
        return mat != null ? mat.subtract(fd.getInvestedAmount()) : null;
    }

    // Pro-rata coupon income accrued from purchaseDate to today (or maturityDate, whichever is earlier).
    // Uses simple day-count: faceValue × couponRate / 100 × days / 365, net of TDS.
    private BigDecimal computeBondAccrued(Investment bond) {
        if (bond.getCouponRate() == null || bond.getPurchaseDate() == null) return null;
        // Coupon is always on face value, not on purchase price
        BigDecimal fv = bond.getFaceValue() != null ? bond.getFaceValue() : bond.getAvgBuyPrice();
        BigDecimal faceValueTotal = fv != null && bond.getUnits() != null
            ? fv.multiply(bond.getUnits())
            : bond.getInvestedAmount();
        LocalDate to = LocalDate.now();
        if (bond.getMaturityDate() != null && bond.getMaturityDate().isBefore(to)) to = bond.getMaturityDate();
        long days = ChronoUnit.DAYS.between(bond.getPurchaseDate(), to);
        if (days <= 0) return BigDecimal.ZERO;
        BigDecimal gross = faceValueTotal
            .multiply(bond.getCouponRate())
            .divide(BigDecimal.valueOf(100), 10, RoundingMode.HALF_UP)
            .multiply(BigDecimal.valueOf(days))
            .divide(BigDecimal.valueOf(365), 2, RoundingMode.HALF_UP);
        BigDecimal tdsRate = bond.getTdsRate() != null ? bond.getTdsRate() : BigDecimal.ZERO;
        if (tdsRate.compareTo(BigDecimal.ZERO) > 0)
            gross = gross.multiply(BigDecimal.ONE.subtract(
                tdsRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)
            )).setScale(2, RoundingMode.HALF_UP);
        return gross;
    }

    // ── Phase 2: Dividend suggestions ─────────────────────────────────────────

    @Override @Transactional(readOnly = true)
    public List<DividendSuggestionResponse> getDividendSuggestions(UUID userId) {
        List<Investment> stocks = investmentRepository.findByUserIdAndActiveTrue(userId).stream()
            .filter(i -> i.getInvestmentType() == InvestmentType.STOCK
                      && i.getSymbol() != null
                      && i.getUnits() != null
                      && i.getPurchaseDate() != null)
            .toList();
        if (stocks.isEmpty()) return List.of();

        // Collect dismissed dividends for this user once to avoid per-action DB hits
        Set<String> dismissed = dismissedDividendRepository.findByUserId(userId).stream()
            .map(d -> d.getInvestmentId() + "|" + d.getExDate())
            .collect(Collectors.toSet());

        // Batched instead of one findBySymbolAndExDateAfter call per stock + one
        // existsByInvestmentIdAndIncomeTypeAndEventDate call per (stock, corporate action) pair —
        // an N+N*M query fan-out this endpoint used to run on every dashboard load. Symbol lookups
        // still need each stock's own purchaseDate applied as the real per-stock floor (this shared
        // "earliest across the portfolio" floor is deliberately loose, see the repository method's
        // own comment).
        Set<String> symbols = stocks.stream().map(Investment::getSymbol).collect(Collectors.toSet());
        LocalDate earliestPurchase = stocks.stream().map(Investment::getPurchaseDate).min(LocalDate::compareTo).orElseThrow();
        Map<String, List<NseCorporateAction>> actionsBySymbol =
            corpActionRepository.findBySymbolInAndExDateAfterOrderByExDateDesc(symbols, earliestPurchase).stream()
                .collect(Collectors.groupingBy(NseCorporateAction::getSymbol));

        Set<UUID> investmentIds = stocks.stream().map(Investment::getId).collect(Collectors.toSet());
        Set<String> logged = incomeLogRepository.findByInvestmentIdInAndIncomeType(investmentIds, "DIVIDEND").stream()
            .map(l -> l.getInvestmentId() + "|" + l.getEventDate())
            .collect(Collectors.toSet());

        List<DividendSuggestionResponse> suggestions = new ArrayList<>();
        for (Investment inv : stocks) {
            List<NseCorporateAction> actions = actionsBySymbol.getOrDefault(inv.getSymbol(), List.of());
            for (NseCorporateAction ca : actions) {
                if (!ca.getExDate().isAfter(inv.getPurchaseDate())) continue;
                BigDecimal dps = ca.getDividendPerShare() != null ? ca.getDividendPerShare() : BigDecimal.ZERO;
                if (dps.compareTo(BigDecimal.ZERO) <= 0) continue;
                // Skip dismissed suggestions (issue #3)
                if (dismissed.contains(inv.getId() + "|" + ca.getExDate())) continue;
                BigDecimal suggested = inv.getUnits().multiply(dps).setScale(2, RoundingMode.HALF_UP);
                suggestions.add(DividendSuggestionResponse.builder()
                    .investmentId(inv.getId())
                    .symbol(inv.getSymbol())
                    .companyName(inv.getCompanyName())
                    .exDate(ca.getExDate())
                    .dividendPerShare(dps)
                    .sharesHeld(inv.getUnits())
                    .suggestedIncome(suggested)
                    .alreadyLogged(logged.contains(inv.getId() + "|" + ca.getExDate()))
                    .build());
            }
        }
        suggestions.sort(Comparator.comparing(DividendSuggestionResponse::getExDate).reversed());
        return suggestions;
    }

    // ── Phase 3: SIP transactions + XIRR ─────────────────────────────────────

    @Override @Transactional
    public SipTransactionResponse addSipTransaction(UUID investmentId, UUID userId, CreateSipTransactionRequest req) {
        Investment inv = findAndValidate(investmentId, userId);
        SipTransaction st = sipTransactionRepository.save(SipTransaction.builder()
            .investmentId(inv.getId())
            .transactionDate(req.getTransactionDate())
            .amount(req.getAmount())
            .units(req.getUnits())
            .nav(req.getNav())
            .transactionType(req.getTransactionType() != null ? req.getTransactionType() : "BUY")
            .notes(req.getNotes())
            .build());

        // Recalculate invested amount as sum of all SIP buys
        BigDecimal totalInvested = sipTransactionRepository.sumBuyAmountByInvestmentId(inv.getId());
        BigDecimal totalUnits    = sipTransactionRepository.sumUnitsByInvestmentId(inv.getId());
        if (totalInvested.compareTo(BigDecimal.ZERO) > 0) {
            inv.setInvestedAmount(totalInvested);
            if (totalUnits.compareTo(BigDecimal.ZERO) > 0) {
                inv.setUnits(totalUnits);
                inv.setAvgBuyPrice(totalInvested.divide(totalUnits, 4, RoundingMode.HALF_UP));
                if (inv.getCurrentPrice() != null)
                    inv.setCurrentValue(totalUnits.multiply(inv.getCurrentPrice()));
            }
            investmentRepository.save(inv);
        }
        return toSipResponse(st);
    }

    @Override @Transactional(readOnly = true)
    public List<SipTransactionResponse> getSipTransactions(UUID investmentId, UUID userId) {
        findAndValidate(investmentId, userId);
        return sipTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)
            .stream().map(this::toSipResponse).toList();
    }

    @Override @Transactional
    public void deleteSipTransaction(Long sipId, UUID userId) {
        SipTransaction st = sipTransactionRepository.findById(sipId)
            .orElseThrow(() -> new ResourceNotFoundException("SipTransaction", "id", sipId));
        Investment inv = findAndValidate(st.getInvestmentId(), userId);
        sipTransactionRepository.delete(st);
        // Recalculate totals after deletion
        BigDecimal totalInvested = sipTransactionRepository.sumBuyAmountByInvestmentId(inv.getId());
        BigDecimal totalUnits    = sipTransactionRepository.sumUnitsByInvestmentId(inv.getId());
        inv.setInvestedAmount(totalInvested.compareTo(BigDecimal.ZERO) > 0 ? totalInvested : BigDecimal.ZERO);
        if (totalUnits.compareTo(BigDecimal.ZERO) > 0) {
            inv.setUnits(totalUnits);
            if (inv.getInvestedAmount().compareTo(BigDecimal.ZERO) > 0)
                inv.setAvgBuyPrice(inv.getInvestedAmount().divide(totalUnits, 4, java.math.RoundingMode.HALF_UP));
        }
        investmentRepository.save(inv);
    }

    // Appends this investment's dated cashflows to the running lists — shared by computeXirr (one
    // investment) and computePortfolioXirr (every active investment's cashflows combined on one
    // timeline). Checks both ledgers an investment can have (a SIP ledger for recurring/mutual-fund
    // style buys, a stock-transaction ledger for buy-more/sell trades) rather than just SIP, so a
    // stock bought incrementally over time doesn't collapse to "the whole current invested amount
    // went in on day one" — which would silently understate or overstate the real annualized return.
    // Falls back to a single outflow on the purchase date only when neither ledger has any rows.
    private void appendInvestmentCashflows(Investment inv, List<SipTransaction> sipTxns, List<StockTransaction> stockTxns,
                                            List<Double> cashflows, List<LocalDate> dates) {
        boolean any = false;
        for (SipTransaction t : sipTxns) {
            // BUY = outflow (negative), REDEEM = inflow (positive)
            double sign = "REDEEM".equalsIgnoreCase(t.getTransactionType()) ? 1.0 : -1.0;
            cashflows.add(sign * t.getAmount().doubleValue());
            dates.add(t.getTransactionDate());
            any = true;
        }
        for (StockTransaction t : stockTxns) {
            // Same cost/proceeds formula addStockTransaction uses when moving money between
            // accounts: BUY costs quantity×price plus brokerage, SELL nets quantity×price minus
            // brokerage.
            BigDecimal gross = t.getQuantity().multiply(t.getPricePerShare());
            BigDecimal brokerage = t.getBrokerage() != null ? t.getBrokerage() : BigDecimal.ZERO;
            boolean isSell = "SELL".equalsIgnoreCase(t.getTransactionType());
            BigDecimal signed = isSell ? gross.subtract(brokerage) : gross.add(brokerage).negate();
            cashflows.add(signed.doubleValue());
            dates.add(t.getTransactionDate());
            any = true;
        }
        if (!any && inv.getPurchaseDate() != null && inv.getInvestedAmount() != null) {
            // No ledger at all — treat as one outflow on the purchase date
            cashflows.add(-inv.getInvestedAmount().doubleValue());
            dates.add(inv.getPurchaseDate());
        }
    }

    @Override @Transactional(readOnly = true)
    public Double computeXirr(UUID investmentId, UUID userId) {
        Investment inv = findAndValidate(investmentId, userId);
        List<SipTransaction> sipTxns = sipTransactionRepository
            .findByInvestmentIdOrderByTransactionDateAsc(investmentId);
        List<StockTransaction> stockTxns = stockTransactionRepository
            .findByInvestmentIdOrderByTransactionDateAsc(investmentId);

        BigDecimal currentVal = inv.getCurrentValue();
        if (currentVal == null || currentVal.compareTo(BigDecimal.ZERO) <= 0) return null;

        List<Double> cashflows = new ArrayList<>();
        List<LocalDate> dates   = new ArrayList<>();
        appendInvestmentCashflows(inv, sipTxns, stockTxns, cashflows, dates);
        if (cashflows.isEmpty()) return null;

        // Final cashflow = current value today (positive inflow = liquidation)
        cashflows.add(currentVal.doubleValue());
        dates.add(LocalDate.now());

        double xirr = XirrCalculator.calculate(cashflows, dates);
        if (Double.isNaN(xirr) && inv.getPurchaseDate() != null) {
            // Fall back to simple annualized return
            double years = ChronoUnit.DAYS.between(inv.getPurchaseDate(), LocalDate.now()) / 365.0;
            xirr = XirrCalculator.simpleAnnualized(
                inv.getInvestedAmount().doubleValue(), currentVal.doubleValue(), years);
        }
        return Double.isNaN(xirr) ? null : Math.round(xirr * 100.0) / 100.0;
    }

    // Aggregates every given investment's own cashflow timeline (SIP buys/redeems, stock-ledger
    // buys/sells, or a single purchase-date outflow where neither ledger exists) into one combined
    // timeline, plus one final inflow for their total current value today. This is the
    // money-weighted return across the group — not an average of each investment's individual
    // XIRR, which would misweight investments held for different durations or amounts. Shared by
    // computePortfolioXirr (every active investment) and computeTypeXirr (just one type, e.g. every
    // active stock) — same aggregation, just a different input list.
    private Double computeXirrForInvestments(List<Investment> investments) {
        if (investments.isEmpty()) return null;

        List<UUID> investmentIds = investments.stream().map(Investment::getId).toList();
        Map<UUID, List<SipTransaction>> sipTxnsByInvestment = sipTransactionRepository
            .findByInvestmentIdInOrderByTransactionDateAsc(investmentIds).stream()
            .collect(Collectors.groupingBy(SipTransaction::getInvestmentId));
        Map<UUID, List<StockTransaction>> stockTxnsByInvestment = stockTransactionRepository
            .findByInvestmentIdInOrderByTransactionDateAsc(investmentIds).stream()
            .collect(Collectors.groupingBy(StockTransaction::getInvestmentId));

        List<Double> cashflows = new ArrayList<>();
        List<LocalDate> dates  = new ArrayList<>();
        BigDecimal totalCurrentValue = BigDecimal.ZERO;

        for (Investment inv : investments) {
            appendInvestmentCashflows(inv,
                sipTxnsByInvestment.getOrDefault(inv.getId(), List.of()),
                stockTxnsByInvestment.getOrDefault(inv.getId(), List.of()),
                cashflows, dates);
            if (inv.getCurrentValue() != null) totalCurrentValue = totalCurrentValue.add(inv.getCurrentValue());
        }

        if (cashflows.isEmpty() || totalCurrentValue.compareTo(BigDecimal.ZERO) <= 0) return null;

        cashflows.add(totalCurrentValue.doubleValue());
        dates.add(LocalDate.now());

        double xirr = XirrCalculator.calculate(cashflows, dates);
        if (Double.isNaN(xirr)) {
            // Fall back to simple annualized return, spanning from the earliest cashflow to today
            LocalDate earliest = dates.stream().min(LocalDate::compareTo).orElse(null);
            double totalInvested = investments.stream()
                .map(Investment::getInvestedAmount).filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue).sum();
            if (earliest != null) {
                double years = ChronoUnit.DAYS.between(earliest, LocalDate.now()) / 365.0;
                xirr = XirrCalculator.simpleAnnualized(totalInvested, totalCurrentValue.doubleValue(), years);
            }
        }
        return Double.isNaN(xirr) ? null : Math.round(xirr * 100.0) / 100.0;
    }

    @Override @Transactional(readOnly = true)
    public Double computePortfolioXirr(UUID userId) {
        return computeXirrForInvestments(investmentRepository.findByUserIdAndActiveTrue(userId));
    }

    @Override @Transactional(readOnly = true)
    public Double computeTypeXirr(UUID userId, InvestmentType type) {
        List<Investment> investments = investmentRepository.findByUserIdAndActiveTrue(userId).stream()
            .filter(inv -> inv.getInvestmentType() == type)
            .toList();
        return computeXirrForInvestments(investments);
    }

    private SipTransactionResponse toSipResponse(SipTransaction s) {
        return SipTransactionResponse.builder()
            .id(s.getId()).transactionDate(s.getTransactionDate())
            .amount(s.getAmount()).units(s.getUnits()).nav(s.getNav())
            .transactionType(s.getTransactionType()).notes(s.getNotes()).build();
    }

    private Investment findAndValidate(UUID id, UUID userId) {
        Investment inv = investmentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", id));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException();
        return inv;
    }


    private String nameFor(CreateInvestmentRequest r) {
        if (r.getCompanyName() != null && !r.getCompanyName().isBlank()) return r.getCompanyName();
        if (r.getSymbol()      != null && !r.getSymbol().isBlank())      return r.getSymbol();
        if (r.getBankName()    != null && !r.getBankName().isBlank())     return r.getBankName() + " FD";
        return r.getInvestmentType().name();
    }

    @Override
    @Transactional(readOnly = true)
    public IncomeHistoryResponse getIncomeHistory(UUID userId, int year) {
        List<InvestmentIncomeLog> logs = incomeLogRepository.findByUserIdAndYear(userId, year);

        // Build investment lookup map (includes inactive so matured FDs still resolve)
        Map<UUID, Investment> invMap = investmentRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(Investment::getId, i -> i));

        // Build account name lookup map
        Map<UUID, String> accountNames = accountRepository.findByUserIdOrderByCreatedAtAsc(userId).stream()
                .collect(Collectors.toMap(a -> a.getId(), a -> a.getName()));

        BigDecimal dividendTotal    = BigDecimal.ZERO;
        BigDecimal bondCouponTotal  = BigDecimal.ZERO;
        BigDecimal fdMaturityTotal  = BigDecimal.ZERO;

        // Track which (investmentId, incomeType, eventDate) triplets are already credited
        Set<String> creditedKeys = new HashSet<>();

        List<IncomeHistoryResponse.Record> records = new ArrayList<>();
        for (InvestmentIncomeLog log : logs) {
            Investment inv = invMap.get(log.getInvestmentId());
            String invName = inv != null ? resolveInvName(inv) : "Unknown";
            String symbol  = inv != null ? inv.getSymbol() : null;
            UUID   accId   = null;
            if (log.getIncomeEntryId() != null) {
                accId = incomeRepository.findById(log.getIncomeEntryId())
                    .map(e -> e.getAccountId()).orElse(null);
            }
            if (accId == null && inv != null) accId = inv.getLinkedAccountId();
            String accName = accId != null ? accountNames.getOrDefault(accId, "Account") : null;

            switch (log.getIncomeType()) {
                case "DIVIDEND"    -> dividendTotal   = dividendTotal.add(log.getAmount());
                case "BOND_COUPON" -> bondCouponTotal = bondCouponTotal.add(log.getAmount());
                case "FD_MATURITY" -> fdMaturityTotal = fdMaturityTotal.add(log.getAmount());
            }

            BigDecimal units    = inv != null ? inv.getUnits() : null;
            // Prefer the units actually held when this was logged (see the entity field's own
            // comment) — falls back to the investment's current unit count only for rows logged
            // before that column existed, which can be wrong if units have changed since.
            BigDecimal unitsForPerShare = log.getSharesHeld() != null ? log.getSharesHeld() : units;
            BigDecimal perShare = null;
            if ("DIVIDEND".equals(log.getIncomeType()) && unitsForPerShare != null
                    && unitsForPerShare.compareTo(BigDecimal.ZERO) > 0) {
                perShare = log.getAmount().divide(unitsForPerShare, 4, RoundingMode.HALF_UP);
            }

            creditedKeys.add(log.getInvestmentId() + "|" + log.getIncomeType() + "|" + log.getEventDate());
            records.add(IncomeHistoryResponse.Record.builder()
                    .id(log.getId())
                    .incomeType(log.getIncomeType())
                    .eventDate(log.getEventDate())
                    .amount(log.getAmount())
                    .perShare(perShare)
                    .investmentId(log.getInvestmentId())
                    .investmentName(invName)
                    .symbol(symbol)
                    .units(units)
                    .accountId(accId)
                    .accountName(accName)
                    .investmentActive(inv == null || inv.isActive())
                    .credited(true)
                    .build());
        }

        // Add historical dividend records from corporate actions (not yet in income log)
        Set<String> stockSymbols = invMap.values().stream()
            .filter(i -> i.getInvestmentType() == InvestmentType.STOCK && i.getSymbol() != null)
            .map(Investment::getSymbol)
            .collect(Collectors.toSet());
        if (!stockSymbols.isEmpty()) {
            Map<String, Investment> symbolToInv = invMap.values().stream()
                .filter(i -> i.getInvestmentType() == InvestmentType.STOCK && i.getSymbol() != null)
                .collect(Collectors.toMap(Investment::getSymbol, i -> i, (a, b) -> a));

            List<NseCorporateAction> caList = corpActionRepository.findDividendsBySymbolsAndYear(stockSymbols, year);
            for (NseCorporateAction ca : caList) {
                Investment inv = symbolToInv.get(ca.getSymbol());
                if (inv == null || inv.getPurchaseDate() == null) continue;
                if (ca.getExDate().isBefore(inv.getPurchaseDate())) continue;
                String key = inv.getId() + "|DIVIDEND|" + ca.getExDate();
                if (creditedKeys.contains(key)) continue; // already shown as credited
                BigDecimal units     = inv.getUnits() != null ? inv.getUnits() : BigDecimal.ONE;
                BigDecimal perShare  = ca.getDividendPerShare();
                BigDecimal amount    = perShare != null ? perShare.multiply(units).setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                records.add(IncomeHistoryResponse.Record.builder()
                    .id(ca.getId())
                    .incomeType("DIVIDEND")
                    .eventDate(ca.getExDate())
                    .amount(amount)
                    .perShare(perShare)
                    .investmentId(inv.getId())
                    .investmentName(resolveInvName(inv))
                    .symbol(ca.getSymbol())
                    .units(units)
                    .accountId(null)
                    .accountName(null)
                    .investmentActive(inv.isActive())
                    .credited(false)
                    .build());
            }
        }

        // Add historical bond coupon schedule (pre-current-month, display only) — issue #14: include accountName
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        LocalDate yearStart  = LocalDate.of(year, 1, 1);
        LocalDate yearEnd    = LocalDate.of(year, 12, 31);
        for (Investment bond : invMap.values()) {
            if (bond.getInvestmentType() != InvestmentType.BOND
                    || bond.getCouponRate() == null || bond.getCouponFrequency() == null
                    || bond.getPurchaseDate() == null) continue;
            int paymentsPerYear = couponPaymentsPerYear(bond.getCouponFrequency());
            // Coupon is on face value × units, not purchase price (which may differ at discount/premium)
            BigDecimal fv = bond.getFaceValue() != null ? bond.getFaceValue() : bond.getAvgBuyPrice();
            BigDecimal faceValueTotal = fv != null && bond.getUnits() != null
                ? fv.multiply(bond.getUnits())
                : bond.getInvestedAmount();
            BigDecimal grossCoupon = faceValueTotal
                .multiply(bond.getCouponRate())
                .divide(BigDecimal.valueOf(100L * paymentsPerYear), 2, RoundingMode.HALF_UP);
            BigDecimal tdsRate = bond.getTdsRate() != null ? bond.getTdsRate() : BigDecimal.ZERO;
            BigDecimal couponAmt = tdsRate.compareTo(BigDecimal.ZERO) > 0
                ? grossCoupon.multiply(BigDecimal.ONE.subtract(
                    tdsRate.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)))
                    .setScale(2, RoundingMode.HALF_UP)
                : grossCoupon;

            // Resolve account name for display-only records using the bond's linkedAccountId
            String bondAccName = bond.getLinkedAccountId() != null
                ? accountNames.getOrDefault(bond.getLinkedAccountId(), null)
                : null;

            for (LocalDate cpDate : buildCouponDates(bond.getPurchaseDate(), bond.getMaturityDate(), bond.getCouponFrequency(), bond.getCouponCreditDay())) {
                if (cpDate.isBefore(yearStart) || cpDate.isAfter(yearEnd)) continue;
                if (cpDate.isAfter(LocalDate.now())) continue;
                if (cpDate.isBefore(monthStart)) {
                    // Historical — show as display-only if not already credited
                    String key = bond.getId() + "|BOND_COUPON|" + cpDate;
                    if (creditedKeys.contains(key)) continue;
                    records.add(IncomeHistoryResponse.Record.builder()
                        .id(null)
                        .incomeType("BOND_COUPON")
                        .eventDate(cpDate)
                        .amount(couponAmt)
                        .investmentId(bond.getId())
                        .investmentName(resolveInvName(bond))
                        .accountId(bond.getLinkedAccountId())
                        .accountName(bondAccName)   // fix issue #14
                        .credited(false)
                        .investmentActive(bond.isActive())
                        .build());
                }
            }
        }

        records.sort(Comparator.comparing(IncomeHistoryResponse.Record::getEventDate).reversed());

        // Fix issue #15: compute totals from ALL records (credited + display-only) so bond coupon total isn't 0
        BigDecimal allDividendTotal   = BigDecimal.ZERO;
        BigDecimal allBondCouponTotal = BigDecimal.ZERO;
        BigDecimal allFdMaturityTotal = BigDecimal.ZERO;
        for (IncomeHistoryResponse.Record r : records) {
            if (r.getAmount() == null) continue;
            switch (r.getIncomeType()) {
                case "DIVIDEND"    -> allDividendTotal   = allDividendTotal.add(r.getAmount());
                case "BOND_COUPON" -> allBondCouponTotal = allBondCouponTotal.add(r.getAmount());
                case "FD_MATURITY" -> allFdMaturityTotal = allFdMaturityTotal.add(r.getAmount());
            }
        }

        return IncomeHistoryResponse.builder()
                .summary(IncomeHistoryResponse.Summary.builder()
                        .year(year)
                        .dividendTotal(allDividendTotal)
                        .bondCouponTotal(allBondCouponTotal)
                        .fdMaturityTotal(allFdMaturityTotal)
                        .grandTotal(allDividendTotal.add(allBondCouponTotal).add(allFdMaturityTotal))
                        .build())
                .records(records)
                .build();
    }

    private int couponPaymentsPerYear(String freq) {
        return switch (freq.toUpperCase()) {
            case "MONTHLY" -> 12; case "QUARTERLY" -> 4; case "HALF_YEARLY" -> 2; default -> 1;
        };
    }

    private List<LocalDate> buildCouponDates(LocalDate from, LocalDate to, String freq, Integer creditDay) {
        List<LocalDate> dates = new ArrayList<>();
        int months = switch (freq.toUpperCase()) {
            case "MONTHLY" -> 1; case "QUARTERLY" -> 3; case "HALF_YEARLY" -> 6; default -> 12;
        };
        LocalDate cur = from.plusMonths(months);
        LocalDate end = to != null ? to : LocalDate.now();
        while (!cur.isAfter(end)) {
            LocalDate payDate = creditDay != null && creditDay >= 1
                ? cur.withDayOfMonth(Math.min(creditDay, cur.lengthOfMonth()))
                : cur;
            dates.add(payDate);
            cur = cur.plusMonths(months);
        }
        return dates;
    }

    private String resolveInvName(Investment inv) {
        if (inv.getCompanyName() != null && !inv.getCompanyName().isBlank()) return inv.getCompanyName();
        if (inv.getSymbol()      != null && !inv.getSymbol().isBlank())      return inv.getSymbol();
        if (inv.getBankName()    != null && !inv.getBankName().isBlank())     return inv.getBankName();
        return inv.getInvestmentType().name();
    }

    private AssetType mapToAssetType(InvestmentType type) {
        return switch (type) {
            case STOCK, REIT    -> AssetType.STOCK;
            case MUTUAL_FUND    -> AssetType.MUTUAL_FUND;
            case BOND           -> AssetType.BOND;
            case GOLD, GOLD_ETF -> AssetType.GOLD;
            default             -> AssetType.OTHER;
        };
    }

    // ── Dismiss dividend suggestion (issue #3) ───────────────────────────────

    @Override @Transactional
    public void dismissDividend(UUID investmentId, UUID userId, DismissDividendRequest req) {
        Investment inv = investmentRepository.findById(investmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", investmentId));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException("Access denied");
        LocalDate exDate = LocalDate.parse(req.getExDate());
        if (!dismissedDividendRepository.existsByUserIdAndInvestmentIdAndExDate(userId, investmentId, exDate)) {
            dismissedDividendRepository.save(DismissedDividend.builder()
                .userId(userId).investmentId(investmentId).exDate(exDate).build());
        }
    }

    // ── Stock buy-more / sell transactions (issues #6, #7) ──────────────────

    @Override @Transactional
    public StockTransactionResponse addStockTransaction(UUID investmentId, UUID userId, CreateStockTransactionRequest req) {
        Investment inv = investmentRepository.findById(investmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", investmentId));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException("Access denied");
        accountOwnershipGuard.validateAccountOwnership(req.getDebitAccountId(), userId);

        boolean isSell = "SELL".equalsIgnoreCase(req.getTransactionType());
        BigDecimal brokerage = req.getBrokerage() != null ? req.getBrokerage() : BigDecimal.ZERO;

        // Retroactively seed the initial BUY for investments created before transaction tracking
        if (stockTransactionRepository.countByInvestmentId(investmentId) == 0
                && inv.getUnits() != null && inv.getUnits().compareTo(BigDecimal.ZERO) > 0
                && inv.getAvgBuyPrice() != null) {
            stockTransactionRepository.save(StockTransaction.builder()
                .investmentId(investmentId)
                .transactionDate(inv.getPurchaseDate() != null ? inv.getPurchaseDate() : LocalDate.now())
                .transactionType("BUY")
                .quantity(inv.getUnits())
                .pricePerShare(inv.getAvgBuyPrice())
                .brokerage(inv.getBrokerage() != null ? inv.getBrokerage() : BigDecimal.ZERO)
                .notes(SEED_TXN_NOTE)
                .build());
        }

        StockTransaction txn = StockTransaction.builder()
            .investmentId(investmentId)
            .transactionDate(req.getTransactionDate())
            .transactionType(req.getTransactionType().toUpperCase())
            .quantity(req.getQuantity())
            .pricePerShare(req.getPricePerShare())
            .brokerage(brokerage)
            .notes(req.getNotes())
            .build();
        StockTransaction saved = stockTransactionRepository.save(txn);

        String stockName = inv.getSymbol() != null ? inv.getSymbol() : inv.getCompanyName();

        if (isSell) {
            // Credit sell proceeds (quantity × price − brokerage) to the account
            if (req.getDebitAccountId() != null) {
                BigDecimal proceeds = req.getQuantity().multiply(req.getPricePerShare()).subtract(brokerage);
                if (proceeds.compareTo(BigDecimal.ZERO) > 0) {
                    accountTransferRepository.save(AccountTransfer.builder()
                        .userId(userId)
                        .fromAccountId(null)
                        .toAccountId(req.getDebitAccountId())
                        .amount(proceeds)
                        .transferDate(req.getTransactionDate())
                        .description("Sell " + stockName + " ×" + req.getQuantity())
                        .build());
                }
            }
        } else {
            // Debit buy cost (quantity × price + brokerage) from the account
            if (req.getDebitAccountId() != null) {
                BigDecimal cost = req.getQuantity().multiply(req.getPricePerShare()).add(brokerage);
                accountTransferRepository.save(AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(req.getDebitAccountId())
                    .toAccountId(null)
                    .amount(cost)
                    .transferDate(req.getTransactionDate())
                    .description("Buy " + stockName + " ×" + req.getQuantity())
                    .build());
            }
        }

        recalculateStockTotals(inv, req.getPricePerShare());
        return toStockTxnResponse(saved);
    }

    @Override
    public List<StockTransactionResponse> getStockTransactions(UUID investmentId, UUID userId) {
        Investment inv = investmentRepository.findById(investmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", investmentId));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException("Access denied");
        return stockTransactionRepository.findByInvestmentIdOrderByTransactionDateAsc(investmentId)
            .stream().map(this::toStockTxnResponse).toList();
    }

    @Override @Transactional
    public void deleteStockTransaction(UUID investmentId, Long txnId, UUID userId) {
        Investment inv = investmentRepository.findById(investmentId)
            .orElseThrow(() -> new ResourceNotFoundException("Investment", "id", investmentId));
        if (!inv.getUserId().equals(userId)) throw new AccessDeniedException("Access denied");
        stockTransactionRepository.deleteById(txnId);
        recalculateStockTotals(inv, null);
    }

    /**
     * Recalculates units, avgBuyPrice, investedAmount and currentValue for a stock investment
     * using the Weighted Average Cost (WAC) method:
     *   avgBuyPrice  = totalBuyAmount / totalBuyQty      (unchanged by sells)
     *   netQty       = totalBuyQty − totalSellQty
     *   investedAmount = netQty × avgBuyPrice            (cost basis of remaining shares)
     *
     * Marks investment inactive when all shares are sold (netQty = 0).
     */
    private void recalculateStockTotals(Investment inv, BigDecimal fallbackPrice) {
        UUID investmentId = inv.getId();
        BigDecimal totalBuyQty    = stockTransactionRepository.sumBuyQuantityByInvestmentId(investmentId);
        BigDecimal totalBuyAmount = stockTransactionRepository.sumBuyAmountByInvestmentId(investmentId);
        BigDecimal netQty         = stockTransactionRepository.sumNetQuantityByInvestmentId(investmentId)
                                        .max(BigDecimal.ZERO);

        if (totalBuyQty.compareTo(BigDecimal.ZERO) > 0) {
            // WAC: average cost per share across all BUY transactions (4dp for display)
            BigDecimal wac = totalBuyAmount.divide(totalBuyQty, 4, RoundingMode.HALF_UP);
            inv.setAvgBuyPrice(wac);
            inv.setUnits(netQty);
            // Cost basis: proportional share of total buy amount, computed in one step
            // to avoid amplifying the 4dp WAC rounding error (netQty * WAC can drift
            // by up to netQty × 0.00005, e.g. ₹0.50 on 10,000 shares).
            inv.setInvestedAmount(
                totalBuyAmount.multiply(netQty)
                    .divide(totalBuyQty, 2, RoundingMode.HALF_UP)
            );
        } else {
            inv.setUnits(BigDecimal.ZERO);
            inv.setInvestedAmount(BigDecimal.ZERO);
        }

        BigDecimal price = inv.getCurrentPrice() != null ? inv.getCurrentPrice()
                         : (fallbackPrice != null ? fallbackPrice : BigDecimal.ZERO);
        inv.setCurrentValue(inv.getUnits().multiply(price).setScale(2, RoundingMode.HALF_UP));

        // If all shares are sold, deactivate the position
        if (netQty.compareTo(BigDecimal.ZERO) == 0) {
            inv.setActive(false);
        } else if (!inv.isActive()) {
            inv.setActive(true);
        }

        investmentRepository.save(inv);
    }

    private StockTransactionResponse toStockTxnResponse(StockTransaction t) {
        return StockTransactionResponse.builder()
            .id(t.getId()).investmentId(t.getInvestmentId())
            .transactionDate(t.getTransactionDate()).transactionType(t.getTransactionType())
            .quantity(t.getQuantity()).pricePerShare(t.getPricePerShare())
            .brokerage(t.getBrokerage()).notes(t.getNotes()).createdAt(t.getCreatedAt())
            .build();
    }
}
