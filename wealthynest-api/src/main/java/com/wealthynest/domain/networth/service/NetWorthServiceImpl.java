package com.wealthynest.domain.networth.service;

import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse.AssetBreakdown;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse.LiabilityBreakdown;
import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import com.wealthynest.domain.networth.repository.NetWorthSnapshotRepository;
import com.wealthynest.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NetWorthServiceImpl implements NetWorthService {

    private final WalletAccountService         walletAccountService;
    private final AssetRepository              assetRepository;
    private final LiabilityRepository          liabilityRepository;
    private final InvestmentRepository         investmentRepository;
    private final NetWorthSnapshotRepository   snapshotRepository;
    private final UserRepository               userRepository;

    @Override @Transactional(readOnly = true)
    public NetWorthSummaryResponse getSummary(UUID userId, UUID familyId) {

        // ── Wallet accounts (uses real computed balance) ──────────────────────
        List<AccountResponse> accounts = walletAccountService.getAccounts(userId);

        BigDecimal liquidBalance  = BigDecimal.ZERO;
        BigDecimal emergencyFund  = BigDecimal.ZERO;
        BigDecimal creditCardDebt = BigDecimal.ZERO;
        List<LiabilityBreakdown> creditCardBreakdown = new ArrayList<>();
        for (AccountResponse a : accounts) {
            BigDecimal bal = a.getCurrentBalance() != null ? a.getCurrentBalance() : BigDecimal.ZERO;
            if ("EMERGENCY_FUND".equals(a.getAccountType())) {
                emergencyFund = emergencyFund.add(bal);
                liquidBalance = liquidBalance.add(bal); // EF is liquid money, just earmarked
            } else if ("CREDIT_CARD".equals(a.getAccountType())) {
                BigDecimal outstanding = bal.max(BigDecimal.ZERO); // outstanding is always non-negative
                creditCardDebt = creditCardDebt.add(outstanding);
                if (outstanding.compareTo(BigDecimal.ZERO) > 0) {
                    creditCardBreakdown.add(LiabilityBreakdown.builder()
                            .liabilityType("CREDIT_CARD")
                            .count(1)
                            .totalOutstanding(outstanding)
                            .build());
                }
            } else {
                liquidBalance = liquidBalance.add(bal);
            }
        }

        // ── Investment portfolio ─────────────────────────────────────────────
        BigDecimal investmentValue = investmentRepository.sumCurrentValueByUser(userId);
        if (investmentValue == null) investmentValue = BigDecimal.ZERO;

        // ── Assets ───────────────────────────────────────────────────────────
        List<Asset> assets = assetRepository.findByUserIdAndActiveTrue(userId);

        // Investment-type breakdown built from investment repository so FD, PPF, REIT etc. display correctly
        List<Investment> userInvestments = investmentRepository.findByUserIdAndActiveTrue(userId);
        Set<UUID> invLinkedAssetIds = userInvestments.stream()
                .filter(i -> i.getAssetId() != null)
                .map(Investment::getAssetId)
                .collect(Collectors.toSet());

        Map<String, BigDecimal> invTypeValues = userInvestments.stream()
                .filter(i -> i.getCurrentValue() != null)
                .collect(Collectors.groupingBy(
                        i -> i.getInvestmentType().name(),
                        Collectors.reducing(BigDecimal.ZERO,
                                i -> i.getCurrentValue() != null ? i.getCurrentValue() : BigDecimal.ZERO,
                                BigDecimal::add)));
        Map<String, Long> invTypeCounts = userInvestments.stream()
                .collect(Collectors.groupingBy(i -> i.getInvestmentType().name(), Collectors.counting()));

        List<AssetBreakdown> invTypeBreakdown = invTypeValues.entrySet().stream()
                .filter(e -> e.getValue().compareTo(BigDecimal.ZERO) > 0)
                .map(e -> AssetBreakdown.builder()
                        .assetType(e.getKey())
                        .count(invTypeCounts.getOrDefault(e.getKey(), 0L).intValue())
                        .totalValue(e.getValue())
                        .build())
                .sorted(Comparator.comparing(AssetBreakdown::getTotalValue).reversed())
                .collect(Collectors.toList());

        // Manual assets — exclude investment-linked assets (avoid double-counting in breakdown display)
        List<Asset> manualOnlyAssets = assets.stream()
                .filter(a -> !invLinkedAssetIds.contains(a.getId()))
                .toList();

        Map<String, List<Asset>> manualAssetsByType = manualOnlyAssets.stream()
                .collect(Collectors.groupingBy(a -> a.getAssetType().name()));

        List<AssetBreakdown> manualAssetBreakdown = manualAssetsByType.entrySet().stream()
                .map(e -> AssetBreakdown.builder()
                        .assetType(e.getKey())
                        .count(e.getValue().size())
                        .totalValue(e.getValue().stream()
                                .map(Asset::getCurrentValue)
                                .reduce(BigDecimal.ZERO, BigDecimal::add))
                        .build())
                .sorted(Comparator.comparing(AssetBreakdown::getTotalValue).reversed())
                .collect(Collectors.toList());

        List<AssetBreakdown> assetBreakdown = new ArrayList<>(invTypeBreakdown);
        assetBreakdown.addAll(manualAssetBreakdown);

        BigDecimal manualAssetsValue = manualOnlyAssets.stream()
                .map(Asset::getCurrentValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── Liabilities ──────────────────────────────────────────────────────
        List<Liability> liabilities = liabilityRepository
                .findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId);

        Map<String, List<Liability>> liabilityByType = liabilities.stream()
                .collect(Collectors.groupingBy(l -> l.getLiabilityType().name()));

        List<LiabilityBreakdown> liabilityBreakdown = liabilityByType.entrySet().stream()
                .map(e -> LiabilityBreakdown.builder()
                        .liabilityType(e.getKey())
                        .count(e.getValue().size())
                        .totalOutstanding(e.getValue().stream()
                                .map(Liability::getOutstandingAmount)
                                .reduce(BigDecimal.ZERO, BigDecimal::add))
                        .build())
                .sorted(Comparator.comparing(LiabilityBreakdown::getTotalOutstanding).reversed())
                .collect(Collectors.toList());

        BigDecimal manualLiabilities = liabilities.stream()
                .map(Liability::getOutstandingAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalLiabilities = manualLiabilities.add(creditCardDebt);

        // Merge credit card breakdown into liability breakdown list
        List<LiabilityBreakdown> allLiabilityBreakdown = new ArrayList<>(liabilityBreakdown);
        if (!creditCardBreakdown.isEmpty()) {
            BigDecimal totalCC = creditCardBreakdown.stream()
                    .map(LiabilityBreakdown::getTotalOutstanding)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            allLiabilityBreakdown.add(LiabilityBreakdown.builder()
                    .liabilityType("CREDIT_CARD")
                    .count(creditCardBreakdown.size())
                    .totalOutstanding(totalCC)
                    .build());
        }
        allLiabilityBreakdown.sort(Comparator.comparing(LiabilityBreakdown::getTotalOutstanding).reversed());

        // ── Totals ───────────────────────────────────────────────────────────
        BigDecimal totalAssets = liquidBalance
                .add(investmentValue)
                .add(manualAssetsValue);

        BigDecimal totalNetWorth = totalAssets.subtract(totalLiabilities);

        return NetWorthSummaryResponse.builder()
                .totalNetWorth(totalNetWorth)
                .totalAssets(totalAssets)
                .totalLiabilities(totalLiabilities)
                .liquidBalance(liquidBalance)
                .emergencyFund(emergencyFund)
                .investmentValue(investmentValue)
                .manualAssetsValue(manualAssetsValue)
                .assetBreakdown(assetBreakdown)
                .liabilityBreakdown(allLiabilityBreakdown)
                .build();
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal getFamilyNetWorth(UUID familyId) {
        var members = userRepository.findByFamilyId(familyId);
        BigDecimal total = BigDecimal.ZERO;
        for (var member : members) {
            UUID uid = member.getId();
            // Wallet accounts — split into liquid and credit card debt
            BigDecimal walletBalance = BigDecimal.ZERO;
            BigDecimal ccDebt = BigDecimal.ZERO;
            for (AccountResponse a : walletAccountService.getAccounts(uid)) {
                BigDecimal bal = a.getCurrentBalance() != null ? a.getCurrentBalance() : BigDecimal.ZERO;
                if ("CREDIT_CARD".equals(a.getAccountType())) {
                    ccDebt = ccDebt.add(bal.max(BigDecimal.ZERO));
                } else {
                    walletBalance = walletBalance.add(bal);
                }
            }
            // Investment portfolio
            BigDecimal invValue = investmentRepository.sumCurrentValueByUser(uid);
            if (invValue == null) invValue = BigDecimal.ZERO;
            // Manual assets only — excludes investment-linked assets to avoid double-counting with invValue
            BigDecimal assetValue = assetRepository.sumManualAssetValueByUser(uid);
            if (assetValue == null) assetValue = BigDecimal.ZERO;
            // Manual liabilities
            BigDecimal liabilities = liabilityRepository.sumOutstandingByUser(uid);
            if (liabilities == null) liabilities = BigDecimal.ZERO;

            total = total
                .add(walletBalance)
                .add(invValue)
                .add(assetValue)
                .subtract(liabilities)
                .subtract(ccDebt);
        }
        return total;
    }

    @Override
    @Transactional
    public void saveSnapshot(UUID userId, BigDecimal netWorth, int year, int month) {
        NetWorthSnapshot snap = snapshotRepository
                .findByUserIdAndYearAndMonth(userId, year, month)
                .orElseGet(() -> NetWorthSnapshot.builder().userId(userId).year(year).month(month).build());
        snap.setNetWorth(netWorth);
        snapshotRepository.save(snap);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NetWorthSnapshot> getHistory(UUID userId) {
        List<NetWorthSnapshot> snaps = new ArrayList<>(snapshotRepository.findLast13ByUserId(userId));
        Collections.reverse(snaps); // return oldest → newest
        return snaps;
    }
}
