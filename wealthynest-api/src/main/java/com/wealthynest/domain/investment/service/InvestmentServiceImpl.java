package com.wealthynest.domain.investment.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.response.*;
import com.wealthynest.domain.investment.entity.*;
import com.wealthynest.domain.investment.repository.*;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.dto.request.LogIncomeRequest;
import com.wealthynest.infra.external.ExternalPriceService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import com.wealthynest.infra.util.XirrCalculator;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvestmentServiceImpl implements InvestmentService {

    private final InvestmentRepository          investmentRepository;
    private final AssetRepository               assetRepository;
    private final StockPriceCacheRepository     stockPriceCacheRepository;
    private final GoldPriceCacheRepository      goldPriceCacheRepository;
    private final MFNavCacheRepository          mfNavCacheRepository;
    private final StockMasterRepository         stockMasterRepository;
    private final SipTransactionRepository      sipTransactionRepository;
    private final NseCorporateActionRepository  corpActionRepository;
    private final InvestmentIncomeLogRepository incomeLogRepository;
    private final WalletAccountRepository       accountRepository;
    private final AccountTransferRepository     accountTransferRepository;
    private final IncomeRepository              incomeRepository;
    private final ExternalPriceService          externalPriceService;
    private final AutoIncomeScheduler           autoIncomeScheduler;

    @Override @Transactional
    public InvestmentResponse createInvestment(UUID userId, CreateInvestmentRequest req) {
        // Auto-create linked asset
        UUID assetId = req.getAssetId();
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
            .couponRate(req.getCouponRate()).couponFrequency(req.getCouponFrequency())
            .couponCreditDay(req.getCouponCreditDay())
            .maturityDate(req.getMaturityDate()).bankName(req.getBankName())
            .compoundingFrequency(req.getCompoundingFrequency())
            .quantityGrams(req.getQuantityGrams())
            .goldKarat(req.getGoldKarat() != null ? req.getGoldKarat() : 22)
            .linkedAccountId(req.getLinkedAccountId())
            .notes(req.getNotes()).active(true).build();

        Investment saved = investmentRepository.save(inv);

        // Create a debit transfer if a source account was specified (toAccountId null = investment has no real destination)
        if (req.getDebitAccountId() != null) {
            AccountTransfer debitTransfer = AccountTransfer.builder()
                .userId(userId)
                .fromAccountId(req.getDebitAccountId())
                .toAccountId(null)
                .amount(req.getInvestedAmount())
                .transferDate(req.getPurchaseDate() != null ? req.getPurchaseDate() : LocalDate.now())
                .description("Investment: " + nameFor(req))
                .build();
            AccountTransfer savedTransfer = accountTransferRepository.save(debitTransfer);
            saved.setDebitTransferId(savedTransfer.getId());
            saved.setDebitAccountId(req.getDebitAccountId());
            investmentRepository.save(saved);
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

        // Sync debit transfer amount if investedAmount was corrected
        if (inv.getDebitTransferId() != null && req.getInvestedAmount() != null
                && req.getInvestedAmount().compareTo(inv.getInvestedAmount()) != 0) {
            accountTransferRepository.findById(inv.getDebitTransferId()).ifPresent(t -> {
                t.setAmount(req.getInvestedAmount());
                accountTransferRepository.save(t);
            });
        }

        inv.setInvestmentType(req.getInvestmentType());
        inv.setSymbol(req.getSymbol());
        inv.setExchange(req.getExchange() != null ? req.getExchange() : "NSE");
        inv.setSchemeCode(req.getSchemeCode());
        inv.setCompanyName(req.getCompanyName());
        inv.setUnits(req.getUnits());
        inv.setAvgBuyPrice(req.getAvgBuyPrice());
        inv.setCurrentPrice(req.getCurrentPrice());
        inv.setInvestedAmount(req.getInvestedAmount());
        inv.setCurrentValue(computeCurrentValue(req));
        inv.setSipAmount(req.getSipAmount());
        inv.setSipDay(req.getSipDay());
        inv.setPurchaseDate(req.getPurchaseDate());
        inv.setCouponRate(req.getCouponRate());
        inv.setCouponFrequency(req.getCouponFrequency());
        inv.setCouponCreditDay(req.getCouponCreditDay());
        inv.setMaturityDate(req.getMaturityDate());
        inv.setBankName(req.getBankName());
        inv.setCompoundingFrequency(req.getCompoundingFrequency());
        inv.setQuantityGrams(req.getQuantityGrams());
        inv.setLinkedAccountId(req.getLinkedAccountId());
        inv.setNotes(req.getNotes());
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
        return investmentRepository.findByUserIdAndActiveTrue(userId).stream()
            .map(this::enrich).toList();
    }

    @Override
    public List<InvestmentSearchResult> searchStocks(String query) {
        if (query == null || query.isBlank()) return List.of();
        return stockMasterRepository.search(query.trim(), Pageable.ofSize(15)).stream()
            .map(s -> InvestmentSearchResult.builder()
                .symbol(s.getSymbol()).name(s.getCompanyName())
                .exchange(s.getExchange()).type("STOCK").build())
            .toList();
    }

    @Override
    public List<InvestmentSearchResult> searchMF(String query) {
        return externalPriceService.searchMFSchemes(query).stream()
            .map(m -> InvestmentSearchResult.builder()
                .schemeCode(m.get("schemeCode")).name(m.get("schemeName")).type("MF").build())
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
            .build());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private InvestmentResponse enrich(Investment inv) {
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
            maturityAmt    = computeFDMaturity(inv);
            accruedInterest = computeFDAccrued(inv);
        } else if (inv.getInvestmentType() == InvestmentType.BOND && inv.getCouponRate() != null) {
            maturityAmt = inv.getInvestedAmount(); // face value returned at maturity
        }

        BigDecimal gainLoss = currentVal.subtract(inv.getInvestedAmount());
        double gainLossPct  = inv.getInvestedAmount().compareTo(BigDecimal.ZERO) > 0
            ? gainLoss.divide(inv.getInvestedAmount(), 4, RoundingMode.HALF_UP)
                      .multiply(BigDecimal.valueOf(100)).doubleValue() : 0.0;

        String debitAccountName = null;
        if (inv.getDebitAccountId() != null) {
            debitAccountName = accountRepository.findById(inv.getDebitAccountId())
                .map(a -> a.getName()).orElse(null);
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
            .purchaseDate(inv.getPurchaseDate())
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
            .notes(inv.getNotes())
            .active(inv.isActive()).createdAt(inv.getCreatedAt())
            .dayChange(dayChange).dayChangePct(dayChangePct)
            .week52High(w52h).week52Low(w52l)
            .priceLastUpdated(priceLastUpdated)
            .build();
    }

    private BigDecimal computeCurrentValue(CreateInvestmentRequest req) {
        if (req.getUnits() != null && req.getCurrentPrice() != null)
            return req.getUnits().multiply(req.getCurrentPrice()).setScale(2, RoundingMode.HALF_UP);
        if (req.getQuantityGrams() != null && req.getCurrentPrice() != null)
            return req.getQuantityGrams().multiply(req.getCurrentPrice()).setScale(2, RoundingMode.HALF_UP);
        return req.getCurrentValue();
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

    // ── Phase 2: Dividend suggestions ─────────────────────────────────────────

    @Override @Transactional(readOnly = true)
    public List<DividendSuggestionResponse> getDividendSuggestions(UUID userId) {
        List<Investment> stocks = investmentRepository.findByUserIdAndActiveTrue(userId).stream()
            .filter(i -> i.getInvestmentType() == InvestmentType.STOCK
                      && i.getSymbol() != null
                      && i.getUnits() != null
                      && i.getPurchaseDate() != null)
            .toList();

        List<DividendSuggestionResponse> suggestions = new ArrayList<>();
        for (Investment inv : stocks) {
            List<NseCorporateAction> actions =
                corpActionRepository.findBySymbolAndExDateAfterOrderByExDateDesc(
                    inv.getSymbol(), inv.getPurchaseDate());
            for (NseCorporateAction ca : actions) {
                BigDecimal dps = ca.getDividendPerShare() != null ? ca.getDividendPerShare() : BigDecimal.ZERO;
                if (dps.compareTo(BigDecimal.ZERO) <= 0) continue;
                BigDecimal suggested = inv.getUnits().multiply(dps).setScale(2, RoundingMode.HALF_UP);
                boolean logged = incomeLogRepository.existsByInvestmentIdAndIncomeTypeAndEventDate(
                    inv.getId(), "DIVIDEND", ca.getExDate());
                suggestions.add(DividendSuggestionResponse.builder()
                    .investmentId(inv.getId())
                    .symbol(inv.getSymbol())
                    .companyName(inv.getCompanyName())
                    .exDate(ca.getExDate())
                    .dividendPerShare(dps)
                    .sharesHeld(inv.getUnits())
                    .suggestedIncome(suggested)
                    .alreadyLogged(logged)
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

    @Override @Transactional(readOnly = true)
    public Double computeXirr(UUID investmentId, UUID userId) {
        Investment inv = findAndValidate(investmentId, userId);
        List<SipTransaction> txns = sipTransactionRepository
            .findByInvestmentIdOrderByTransactionDateAsc(investmentId);

        BigDecimal currentVal = inv.getCurrentValue();
        if (currentVal == null || currentVal.compareTo(BigDecimal.ZERO) <= 0) return null;

        List<Double> cashflows = new ArrayList<>();
        List<LocalDate> dates   = new ArrayList<>();

        if (!txns.isEmpty()) {
            for (SipTransaction t : txns) {
                // BUY = outflow (negative), REDEEM = inflow (positive)
                double sign = "REDEEM".equalsIgnoreCase(t.getTransactionType()) ? 1.0 : -1.0;
                cashflows.add(sign * t.getAmount().doubleValue());
                dates.add(t.getTransactionDate());
            }
        } else if (inv.getPurchaseDate() != null) {
            // Single purchase — treat as one outflow
            cashflows.add(-inv.getInvestedAmount().doubleValue());
            dates.add(inv.getPurchaseDate());
        } else {
            return null;
        }

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
            BigDecimal perShare = null;
            if ("DIVIDEND".equals(log.getIncomeType()) && units != null
                    && units.compareTo(BigDecimal.ZERO) > 0) {
                perShare = log.getAmount().divide(units, 4, RoundingMode.HALF_UP);
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

        // Add historical bond coupon schedule (pre-current-month, display only)
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        LocalDate yearStart  = LocalDate.of(year, 1, 1);
        LocalDate yearEnd    = LocalDate.of(year, 12, 31);
        for (Investment bond : invMap.values()) {
            if (bond.getInvestmentType() != InvestmentType.BOND
                    || bond.getCouponRate() == null || bond.getCouponFrequency() == null
                    || bond.getPurchaseDate() == null) continue;
            int paymentsPerYear = couponPaymentsPerYear(bond.getCouponFrequency());
            BigDecimal couponAmt = bond.getInvestedAmount()
                .multiply(bond.getCouponRate())
                .divide(BigDecimal.valueOf(100L * paymentsPerYear), 2, RoundingMode.HALF_UP);
            for (LocalDate cpDate : buildCouponDates(bond.getPurchaseDate(), bond.getMaturityDate(), bond.getCouponFrequency())) {
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
                        .credited(false)
                        .investmentActive(bond.isActive())
                        .build());
                }
            }
        }

        records.sort(Comparator.comparing(IncomeHistoryResponse.Record::getEventDate).reversed());

        return IncomeHistoryResponse.builder()
                .summary(IncomeHistoryResponse.Summary.builder()
                        .year(year)
                        .dividendTotal(dividendTotal)
                        .bondCouponTotal(bondCouponTotal)
                        .fdMaturityTotal(fdMaturityTotal)
                        .grandTotal(dividendTotal.add(bondCouponTotal).add(fdMaturityTotal))
                        .build())
                .records(records)
                .build();
    }

    private int couponPaymentsPerYear(String freq) {
        return switch (freq.toUpperCase()) {
            case "MONTHLY" -> 12; case "QUARTERLY" -> 4; case "HALF_YEARLY" -> 2; default -> 1;
        };
    }

    private List<LocalDate> buildCouponDates(LocalDate from, LocalDate to, String freq) {
        List<LocalDate> dates = new ArrayList<>();
        int months = switch (freq.toUpperCase()) {
            case "MONTHLY" -> 1; case "QUARTERLY" -> 3; case "HALF_YEARLY" -> 6; default -> 12;
        };
        LocalDate cur = from.plusMonths(months);
        LocalDate end = to != null ? to : LocalDate.now();
        while (!cur.isAfter(end)) { dates.add(cur); cur = cur.plusMonths(months); }
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
}
