package com.wealthynest.domain.networth.service;

import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.asset.entity.Asset;
import com.wealthynest.domain.asset.entity.AssetType;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.entity.LiabilityType;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import com.wealthynest.domain.networth.repository.NetWorthSnapshotRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NetWorthServiceImplTest {

    @Mock private WalletAccountService       walletAccountService;
    @Mock private AssetRepository            assetRepository;
    @Mock private LiabilityRepository        liabilityRepository;
    @Mock private InvestmentRepository       investmentRepository;
    @Mock private NetWorthSnapshotRepository snapshotRepository;
    @Mock private UserRepository             userRepository;

    @InjectMocks
    private NetWorthServiceImpl service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void stubEmptyDefaults() {
        lenient().when(walletAccountService.getAccounts(userId)).thenReturn(List.of());
        lenient().when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(BigDecimal.ZERO);
        lenient().when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of());
        lenient().when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of());
        lenient().when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
    }

    // ─── getSummary: account classification ─────────────────────────────────────

    @Nested
    @DisplayName("getSummary: account classification")
    class AccountClassificationTests {

        @Test
        @DisplayName("EMERGENCY_FUND balance counts toward both liquidBalance AND emergencyFund")
        void emergencyFundCountsAsBothLiquidAndEarmarked() {
            AccountResponse ef = AccountResponse.builder().accountType("EMERGENCY_FUND").currentBalance(new BigDecimal("5000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(ef));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("5000");
            assertThat(summary.getEmergencyFund()).isEqualByComparingTo("5000");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("5000"); // not double-counted
        }

        @Test
        @DisplayName("a CREDIT_CARD account's balance becomes a liability, floored at zero")
        void creditCardBalanceBecomesLiabilityFlooredAtZero() {
            AccountResponse cc = AccountResponse.builder().accountType("CREDIT_CARD").currentBalance(new BigDecimal("-200")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(cc));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getTotalLiabilities()).isEqualByComparingTo("0");
            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("0"); // not counted as liquid either
        }

        @Test
        @DisplayName("a LOAN account's positive outstanding contributes to liabilities and the loan-type breakdown")
        void loanOutstandingContributesToLiabilities() {
            AccountResponse loan = AccountResponse.builder().accountType("LOAN").loanType("HOME_LOAN")
                    .currentBalance(new BigDecimal("300000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(loan));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getTotalLiabilities()).isEqualByComparingTo("300000");
            assertThat(summary.getLiabilityBreakdown()).anySatisfy(b -> {
                assertThat(b.getLiabilityType()).isEqualTo("HOME_LOAN");
                assertThat(b.getTotalOutstanding()).isEqualByComparingTo("300000");
            });
        }

        @Test
        @DisplayName("BANK_ACCOUNT / CASH_WALLET / INVESTMENT-type balances are all counted as liquid assets")
        void otherAccountTypesCountAsLiquid() {
            AccountResponse bank = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("1000")).build();
            AccountResponse cash = AccountResponse.builder().accountType("CASH_WALLET").currentBalance(new BigDecimal("200")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(bank, cash));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("1200");
        }
    }

    // ─── getSummary: totals formula ──────────────────────────────────────────────

    @Nested
    @DisplayName("getSummary: totals formula")
    class TotalsFormulaTests {

        @Test
        @DisplayName("totalNetWorth = (liquid + investments + manual assets) - (manual liabilities + CC + loan)")
        void totalNetWorthFormula() {
            AccountResponse bank = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("10000")).build();
            AccountResponse loan = AccountResponse.builder().accountType("LOAN").currentBalance(new BigDecimal("4000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(bank, loan));
            when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(new BigDecimal("50000"));
            Asset manualAsset = Asset.builder().assetType(AssetType.REAL_ESTATE).currentValue(new BigDecimal("2000000")).build();
            ReflectionTestUtils.setField(manualAsset, "id", UUID.randomUUID());
            when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(manualAsset));
            Liability liability = Liability.builder().liabilityType(LiabilityType.PERSONAL_LOAN).outstandingAmount(new BigDecimal("1000")).build();
            when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of(liability));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            // assets: 10000 + 50000 + 2000000 = 2060000; liabilities: 1000 + 4000 = 5000
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("2060000");
            assertThat(summary.getTotalLiabilities()).isEqualByComparingTo("5000");
            assertThat(summary.getTotalNetWorth()).isEqualByComparingTo("2055000");
        }

        @Test
        @DisplayName("an asset linked to an active investment is excluded from manualAssetsValue (avoids double-counting)")
        void investmentLinkedAssetExcludedFromManualValue() {
            UUID linkedAssetId = UUID.randomUUID();
            Asset linkedAsset = Asset.builder().assetType(AssetType.STOCK).currentValue(new BigDecimal("99999")).build();
            ReflectionTestUtils.setField(linkedAsset, "id", linkedAssetId);
            when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(linkedAsset));
            Investment inv = Investment.builder().userId(userId).assetId(linkedAssetId)
                    .investmentType(InvestmentType.STOCK).investedAmount(BigDecimal.ZERO)
                    .currentValue(new BigDecimal("99999")).build();
            when(investmentRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(inv));
            when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(new BigDecimal("99999"));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            // Counted once via investmentValue (99999), NOT again via manualAssetsValue
            assertThat(summary.getManualAssetsValue()).isEqualByComparingTo("0");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("99999");
        }

        @Test
        @DisplayName("null sums from repositories (no data) are treated as zero, not NPE")
        void nullSumsTreatedAsZero() {
            when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(null);

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getInvestmentValue()).isEqualByComparingTo("0");
            assertThat(summary.getTotalNetWorth()).isEqualByComparingTo("0");
        }
    }

    // ─── getFamilyNetWorth ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("getFamilyNetWorth")
    class FamilyNetWorthTests {

        @Test
        @DisplayName("returns zero immediately for a family with no members, without querying anything else")
        void zeroForEmptyFamily() {
            UUID familyId = UUID.randomUUID();
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of());

            BigDecimal result = service.getFamilyNetWorth(familyId);

            assertThat(result).isEqualByComparingTo("0");
            verifyNoInteractions(walletAccountService, investmentRepository, assetRepository, liabilityRepository);
        }

        @Test
        @DisplayName("aggregates wallet balance + investments + assets - liabilities - CC/loan debt across all members")
        void aggregatesAcrossMembers() {
            UUID familyId = UUID.randomUUID();
            UUID member1 = UUID.randomUUID(), member2 = UUID.randomUUID();
            User u1 = User.builder().build(); ReflectionTestUtils.setField(u1, "id", member1);
            User u2 = User.builder().build(); ReflectionTestUtils.setField(u2, "id", member2);
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(u1, u2));

            AccountResponse bank = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("10000")).build();
            AccountResponse cc = AccountResponse.builder().accountType("CREDIT_CARD").currentBalance(new BigDecimal("500")).build();
            when(walletAccountService.getAccountsForUsers(List.of(member1, member2))).thenReturn(List.of(bank, cc));
            when(investmentRepository.sumCurrentValueByUserIn(List.of(member1, member2))).thenReturn(new BigDecimal("20000"));
            when(assetRepository.sumManualAssetValueByUserIn(List.of(member1, member2))).thenReturn(new BigDecimal("5000"));
            when(liabilityRepository.sumOutstandingByUserIn(List.of(member1, member2))).thenReturn(new BigDecimal("1000"));

            BigDecimal result = service.getFamilyNetWorth(familyId);

            // 10000(wallet) + 20000(inv) + 5000(assets) - 1000(liabilities) - 500(cc debt) = 33500
            assertThat(result).isEqualByComparingTo("33500");
        }
    }

    // ─── saveSnapshot ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("saveSnapshot")
    class SaveSnapshotTests {

        @Test
        @DisplayName("creates a new snapshot when none exists for that year/month")
        void createsNewSnapshotWhenNoneExists() {
            when(snapshotRepository.findByUserIdAndYearAndMonth(userId, 2026, 6)).thenReturn(Optional.empty());
            when(snapshotRepository.save(any(NetWorthSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));

            service.saveSnapshot(userId, new BigDecimal("50000"), 2026, 6);

            var captor = org.mockito.ArgumentCaptor.forClass(NetWorthSnapshot.class);
            verify(snapshotRepository).save(captor.capture());
            assertThat(captor.getValue().getNetWorth()).isEqualByComparingTo("50000");
            assertThat(captor.getValue().getYear()).isEqualTo(2026);
        }

        @Test
        @DisplayName("updates the existing snapshot in place (upsert) rather than creating a duplicate")
        void updatesExistingSnapshotInPlace() {
            NetWorthSnapshot existing = NetWorthSnapshot.builder().userId(userId).year(2026).month(6)
                    .netWorth(new BigDecimal("10000")).build();
            when(snapshotRepository.findByUserIdAndYearAndMonth(userId, 2026, 6)).thenReturn(Optional.of(existing));
            when(snapshotRepository.save(any(NetWorthSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));

            service.saveSnapshot(userId, new BigDecimal("60000"), 2026, 6);

            assertThat(existing.getNetWorth()).isEqualByComparingTo("60000");
            verify(snapshotRepository).save(existing);
        }
    }

    // ─── getHistory ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getHistory reverses the repository's newest-first order to oldest-first")
    void getHistoryReversesToOldestFirst() {
        NetWorthSnapshot newest = NetWorthSnapshot.builder().userId(userId).year(2026).month(6).build();
        NetWorthSnapshot oldest = NetWorthSnapshot.builder().userId(userId).year(2025).month(1).build();
        when(snapshotRepository.findLast13ByUserId(userId)).thenReturn(List.of(newest, oldest)); // repo returns newest-first

        List<NetWorthSnapshot> result = service.getHistory(userId);

        assertThat(result).containsExactly(oldest, newest);
    }
}
