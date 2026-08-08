package com.wealthynest.domain.networth.service;

import com.wealthynest.common.entity.LifecycleStatus;
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
import java.time.LocalDate;
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
        lenient().when(investmentRepository.findByUserIdAndStatus(userId, LifecycleStatus.ACTIVE)).thenReturn(List.of());
        lenient().when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
    }

    // ─── getSummary: account classification ─────────────────────────────────────

    @Nested
    @DisplayName("getSummary: account classification")
    class AccountClassificationTests {

        @Test
        @DisplayName("a purpose-tagged BANK_ACCOUNT still counts fully as liquid — purpose is a display tag, not a different bucket")
        void purposeTaggedAccountStillCountsAsLiquid() {
            AccountResponse ef = AccountResponse.builder().accountType("BANK_ACCOUNT").purpose("EMERGENCY_FUND")
                    .currentBalance(new BigDecimal("5000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(ef));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("5000");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("5000");
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
        @DisplayName("BANK_ACCOUNT and CASH_WALLET balances are both counted as liquid assets")
        void otherAccountTypesCountAsLiquid() {
            AccountResponse bank = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("1000")).build();
            AccountResponse cash = AccountResponse.builder().accountType("CASH_WALLET").currentBalance(new BigDecimal("200")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(bank, cash));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("1200");
        }
    }

    // ─── getSummary: excludeFromNetWorth ─────────────────────────────────────────

    @Nested
    @DisplayName("getSummary: excludeFromNetWorth")
    class ExcludeFromNetWorthTests {

        @Test
        @DisplayName("an excluded bank account contributes nothing to liquid balance or total assets")
        void excludedBankAccountContributesNothing() {
            AccountResponse counted  = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("10000")).build();
            AccountResponse excluded = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("99999")).excludeFromNetWorth(true).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(counted, excluded));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getLiquidBalance()).isEqualByComparingTo("10000");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("10000");
        }

        @Test
        @DisplayName("an excluded loan account contributes nothing to total liabilities")
        void excludedLoanContributesNothing() {
            AccountResponse excludedLoan = AccountResponse.builder().accountType("LOAN").loanType("HOME_LOAN")
                    .currentBalance(new BigDecimal("500000")).excludeFromNetWorth(true).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(excludedLoan));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getTotalLiabilities()).isEqualByComparingTo("0");
            assertThat(summary.getLiabilityBreakdown()).isEmpty();
        }

        @Test
        @DisplayName("an excluded account is left out of the purpose breakdown too, even when tagged")
        void excludedAccountLeftOutOfPurposeBreakdown() {
            AccountResponse excluded = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .purpose("EMERGENCY_FUND").currentBalance(new BigDecimal("50000")).excludeFromNetWorth(true).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(excluded));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getPurposeBreakdown()).isEmpty();
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
        @DisplayName("a manual Asset and an unrelated active Investment both count in full — Investment no longer links to Asset")
        void manualAssetAndInvestmentBothCountIndependently() {
            Asset manualAsset = Asset.builder().assetType(AssetType.STOCK).currentValue(new BigDecimal("99999")).build();
            ReflectionTestUtils.setField(manualAsset, "id", UUID.randomUUID());
            when(assetRepository.findByUserIdAndActiveTrue(userId)).thenReturn(List.of(manualAsset));
            Investment inv = Investment.builder().userId(userId)
                    .investmentType(InvestmentType.STOCK).investedAmount(BigDecimal.ZERO)
                    .currentValue(new BigDecimal("50000")).build();
            when(investmentRepository.findByUserIdAndStatus(userId, LifecycleStatus.ACTIVE)).thenReturn(List.of(inv));
            when(investmentRepository.sumCurrentValueByUser(userId)).thenReturn(new BigDecimal("50000"));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getManualAssetsValue()).isEqualByComparingTo("99999");
            assertThat(summary.getInvestmentValue()).isEqualByComparingTo("50000");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("149999");
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

    // ─── getSummary: purposeBreakdown ────────────────────────────────────────────

    @Nested
    @DisplayName("getSummary: purposeBreakdown")
    class PurposeBreakdownTests {

        @Test
        @DisplayName("groups an account and an investment sharing the same purpose into one bucket")
        void groupsAccountAndInvestmentUnderSamePurpose() {
            AccountResponse savings = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .purpose("EMERGENCY_FUND").name("Savings Account").currentBalance(new BigDecimal("200000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(savings));
            Investment fd = Investment.builder().userId(userId).investmentType(InvestmentType.FD)
                    .bankName("HDFC").purpose(com.wealthynest.common.entity.AccountPurpose.EMERGENCY_FUND)
                    .investedAmount(new BigDecimal("500000")).currentValue(new BigDecimal("500000")).build();
            when(investmentRepository.findByUserIdAndStatus(userId, LifecycleStatus.ACTIVE)).thenReturn(List.of(fd));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getPurposeBreakdown()).hasSize(1);
            var bucket = summary.getPurposeBreakdown().get(0);
            assertThat(bucket.getPurpose()).isEqualTo("EMERGENCY_FUND");
            assertThat(bucket.getLabel()).isEqualTo("Emergency Fund");
            assertThat(bucket.getTotalValue()).isEqualByComparingTo("700000");
            assertThat(bucket.getItems()).extracting("sourceType").containsExactlyInAnyOrder("ACCOUNT", "INVESTMENT");
        }

        @Test
        @DisplayName("two rows both tagged CUSTOM with different labels land in two separate buckets, not merged")
        void customPurposeGroupsByLabelNotByTheSharedCustomValue() {
            AccountResponse sabbatical = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .purpose("CUSTOM").purposeLabel("Sabbatical").name("HDFC Sabbatical").currentBalance(new BigDecimal("90000")).build();
            AccountResponse wedding = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .purpose("CUSTOM").purposeLabel("Wedding").name("ICICI Wedding").currentBalance(new BigDecimal("150000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(sabbatical, wedding));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getPurposeBreakdown()).hasSize(2);
            assertThat(summary.getPurposeBreakdown()).extracting("label").containsExactlyInAnyOrder("Sabbatical", "Wedding");
        }

        @Test
        @DisplayName("untagged accounts/investments are excluded from every purpose bucket")
        void untaggedRowsExcludedFromBreakdown() {
            AccountResponse untagged = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .currentBalance(new BigDecimal("1000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(untagged));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getPurposeBreakdown()).isEmpty();
        }

        @Test
        @DisplayName("purposeBreakdown is a re-slice, not additive — it never changes totalAssets")
        void breakdownNeverInflatesTotalAssets() {
            AccountResponse tagged = AccountResponse.builder().accountType("BANK_ACCOUNT")
                    .purpose("GENERAL_SAVINGS").currentBalance(new BigDecimal("42000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(tagged));

            NetWorthSummaryResponse summary = service.getSummary(userId, null);

            assertThat(summary.getPurposeBreakdown()).hasSize(1);
            assertThat(summary.getPurposeBreakdown().get(0).getTotalValue()).isEqualByComparingTo("42000");
            assertThat(summary.getTotalAssets()).isEqualByComparingTo("42000"); // not 84000
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

        @Test
        @DisplayName("an excluded member account contributes nothing to family net worth")
        void excludedAccountContributesNothing() {
            UUID familyId = UUID.randomUUID();
            UUID member1 = UUID.randomUUID();
            User u1 = User.builder().build(); ReflectionTestUtils.setField(u1, "id", member1);
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(u1));

            AccountResponse counted  = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("10000")).build();
            AccountResponse excluded = AccountResponse.builder().accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("99999")).excludeFromNetWorth(true).build();
            when(walletAccountService.getAccountsForUsers(List.of(member1))).thenReturn(List.of(counted, excluded));

            BigDecimal result = service.getFamilyNetWorth(familyId);

            assertThat(result).isEqualByComparingTo("10000");
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

    @Nested
    @DisplayName("getHistory")
    class GetHistoryTests {

        @Test
        @DisplayName("reverses the repository's newest-first order to oldest-first")
        void getHistoryReversesToOldestFirst() {
            LocalDate now = LocalDate.now();
            when(snapshotRepository.findByUserIdAndYearAndMonth(userId, now.getYear(), now.getMonthValue()))
                    .thenReturn(Optional.of(NetWorthSnapshot.builder().userId(userId)
                            .year(now.getYear()).month(now.getMonthValue()).build()));
            NetWorthSnapshot newest = NetWorthSnapshot.builder().userId(userId).year(2026).month(6).build();
            NetWorthSnapshot oldest = NetWorthSnapshot.builder().userId(userId).year(2025).month(1).build();
            when(snapshotRepository.findLast13ByUserId(userId)).thenReturn(List.of(newest, oldest)); // repo returns newest-first

            List<NetWorthSnapshot> result = service.getHistory(userId);

            assertThat(result).containsExactly(oldest, newest);
        }

        @Test
        @DisplayName("eagerly creates a snapshot for the current month when one doesn't exist yet, instead of only ever waiting for the scheduler's previous-month write")
        void createsCurrentMonthSnapshotWhenMissing() {
            LocalDate now = LocalDate.now();
            when(snapshotRepository.findByUserIdAndYearAndMonth(userId, now.getYear(), now.getMonthValue()))
                    .thenReturn(Optional.empty());
            User user = User.builder().build();
            ReflectionTestUtils.setField(user, "id", userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(snapshotRepository.save(any(NetWorthSnapshot.class))).thenAnswer(inv -> inv.getArgument(0));
            when(snapshotRepository.findLast13ByUserId(userId)).thenReturn(List.of());

            service.getHistory(userId);

            var captor = org.mockito.ArgumentCaptor.forClass(NetWorthSnapshot.class);
            verify(snapshotRepository).save(captor.capture());
            assertThat(captor.getValue().getYear()).isEqualTo(now.getYear());
            assertThat(captor.getValue().getMonth()).isEqualTo(now.getMonthValue());
        }

        @Test
        @DisplayName("does not write a snapshot when the current month already has one")
        void skipsWriteWhenCurrentMonthAlreadyExists() {
            LocalDate now = LocalDate.now();
            when(snapshotRepository.findByUserIdAndYearAndMonth(userId, now.getYear(), now.getMonthValue()))
                    .thenReturn(Optional.of(NetWorthSnapshot.builder().userId(userId)
                            .year(now.getYear()).month(now.getMonthValue()).build()));
            when(snapshotRepository.findLast13ByUserId(userId)).thenReturn(List.of());

            service.getHistory(userId);

            verify(snapshotRepository, never()).save(any());
            verifyNoInteractions(userRepository);
        }
    }
}
