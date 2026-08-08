package com.wealthynest.domain.account.service;

import com.wealthynest.common.entity.AccountPurpose;
import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.request.CreateAccountRequest;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.dto.request.UpdateTransferRequest;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.dto.response.TransferResponse;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.goal.repository.GoalRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.notification.service.NotificationService;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletAccountServiceImplTest {

    @Mock private WalletAccountRepository   accountRepository;
    @Mock private AccountTransferRepository transferRepository;
    @Mock private IncomeRepository          incomeRepository;
    @Mock private ExpenseRepository         expenseRepository;
    @Mock private CategoryRepository        categoryRepository;
    @Mock private InvestmentRepository      investmentRepository;
    @Mock private GoalRepository            goalRepository;
    @Mock private AccountBalanceGuard       accountBalanceGuard;
    @Mock private NotificationService       notificationService;

    @InjectMocks
    private WalletAccountServiceImpl service;

    private final UUID userId    = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    private WalletAccount.WalletAccountBuilder baseAccount(AccountType type) {
        return WalletAccount.builder().userId(userId).accountType(type).name("Test Account")
                .openingBalance(new BigDecimal("1000"));
    }

    private WalletAccount withId(WalletAccount a) {
        ReflectionTestUtils.setField(a, "id", accountId);
        return a;
    }

    /** Stubs every enrich()-touched repository call to a harmless zero/empty default. */
    @BeforeEach
    void stubEnrichmentDefaults() {
        lenient().when(incomeRepository.sumByAccountId(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(expenseRepository.sumByAccountId(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumTransfersIn(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumTransfersOut(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumRegularTransfersIn(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumRegularTransfersOut(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(incomeRepository.sumRegularByAccountId(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(expenseRepository.sumRegularByAccountId(any())).thenReturn(BigDecimal.ZERO);
        lenient().when(incomeRepository.findTop5ByAccountIdAndDebtFalseOrderByIncomeDateDesc(any())).thenReturn(List.of());
        lenient().when(expenseRepository.findTop5ByAccountIdAndDebtFalseOrderByExpenseDateDesc(any())).thenReturn(List.of());
        lenient().when(categoryRepository.findAllById(any())).thenReturn(List.of());
        lenient().when(transferRepository.findTop5ByAccountId(any())).thenReturn(List.of());
    }

    private CreateAccountRequest createRequest(AccountType type, BigDecimal opening) {
        CreateAccountRequest req = mock(CreateAccountRequest.class);
        lenient().when(req.getAccountType()).thenReturn(type);
        lenient().when(req.getName()).thenReturn("My Account");
        lenient().when(req.getOpeningBalance()).thenReturn(opening);
        lenient().when(req.getBankName()).thenReturn(null);
        lenient().when(req.getAccountNumber()).thenReturn(null);
        lenient().when(req.getLowBalanceThreshold()).thenReturn(null);
        lenient().when(req.getCreditLimit()).thenReturn(null);
        lenient().when(req.getStatementDay()).thenReturn(null);
        lenient().when(req.getPaymentDueDay()).thenReturn(null);
        lenient().when(req.getApr()).thenReturn(null);
        lenient().when(req.getLoanType()).thenReturn(null);
        lenient().when(req.getPrincipalAmount()).thenReturn(null);
        lenient().when(req.getEmiAmount()).thenReturn(null);
        lenient().when(req.getEmiDay()).thenReturn(null);
        lenient().when(req.getAutopayAccountId()).thenReturn(null);
        lenient().when(req.getLoanEndDate()).thenReturn(null);
        lenient().when(req.getPurpose()).thenReturn(null);
        lenient().when(req.getPurposeLabel()).thenReturn(null);
        return req;
    }

    // ─── enrich() balance formula (via createAccount, which returns the enriched response) ─

    @Nested
    @DisplayName("balance calculation (asset vs liability formula)")
    class BalanceCalculationTests {

        @Test
        @DisplayName("asset account: balance = opening + income + transfersIn - expense - transfersOut")
        void assetBalanceFormula() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(incomeRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("500"));
            when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("200"));
            when(transferRepository.sumTransfersIn(accountId)).thenReturn(new BigDecimal("100"));
            when(transferRepository.sumTransfersOut(accountId)).thenReturn(new BigDecimal("50"));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, new BigDecimal("1000"));

            AccountResponse response = service.createAccount(userId, req);

            // 1000 + 500 + 100 - 200 - 50 = 1350
            assertThat(response.getCurrentBalance()).isEqualByComparingTo("1350");
        }

        @Test
        @DisplayName("liability account: balance = opening + expense + transfersOut - income - transfersIn (mirror image)")
        void liabilityBalanceFormula() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(incomeRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("500")); // a payment in
            when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("200")); // a spend on the card
            when(transferRepository.sumTransfersIn(accountId)).thenReturn(BigDecimal.ZERO);
            when(transferRepository.sumTransfersOut(accountId)).thenReturn(BigDecimal.ZERO);
            CreateAccountRequest req = createRequest(AccountType.CREDIT_CARD, new BigDecimal("1000"));

            AccountResponse response = service.createAccount(userId, req);

            // 1000 + 200(spend) - 500(payment) = 700 outstanding — a payment IN reduces the debt
            assertThat(response.getCurrentBalance()).isEqualByComparingTo("700");
        }

        @Test
        @DisplayName("belowLowBalanceThreshold is never flagged for credit card or loan accounts")
        void belowThresholdExcludesLiabilityTypes() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.CREDIT_CARD, BigDecimal.ZERO);
            when(req.getLowBalanceThreshold()).thenReturn(new BigDecimal("100"));

            AccountResponse response = service.createAccount(userId, req);

            assertThat(response.isBelowLowBalanceThreshold()).isFalse();
        }

        @Test
        @DisplayName("belowLowBalanceThreshold flags true once balance drops to or below the threshold, for asset accounts")
        void belowThresholdFlaggedForAssetAccounts() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("950")); // 1000 - 950 = 50
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, new BigDecimal("1000"));
            when(req.getLowBalanceThreshold()).thenReturn(new BigDecimal("50"));

            AccountResponse response = service.createAccount(userId, req);

            assertThat(response.getCurrentBalance()).isEqualByComparingTo("50");
            assertThat(response.isBelowLowBalanceThreshold()).isTrue();
        }
    }

    // ─── createAccount ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createAccount")
    class CreateAccountTests {

        @Test
        @DisplayName("blocks a second active CASH_WALLET (the one remaining singleton type)")
        void blocksSecondActiveSingletonType() {
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.CASH_WALLET, LifecycleStatus.ACTIVE)).thenReturn(true);
            CreateAccountRequest req = createRequest(AccountType.CASH_WALLET, BigDecimal.ZERO);

            assertThatThrownBy(() -> service.createAccount(userId, req)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).save(any());
        }

        @Test
        @DisplayName("blocks creating CASH_WALLET when an archived one already exists (must restore instead)")
        void blocksWhenArchivedSingletonExists() {
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.CASH_WALLET, LifecycleStatus.ACTIVE)).thenReturn(false);
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.CASH_WALLET, LifecycleStatus.ARCHIVED)).thenReturn(true);
            CreateAccountRequest req = createRequest(AccountType.CASH_WALLET, BigDecimal.ZERO);

            assertThatThrownBy(() -> service.createAccount(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("EMERGENCY_FUND purpose has no singleton constraint — a second BANK_ACCOUNT can carry it")
        void noSingletonConstraintOnEmergencyFundPurpose() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);
            when(req.getPurpose()).thenReturn(AccountPurpose.EMERGENCY_FUND);

            service.createAccount(userId, req); // must not throw, regardless of any existing EF-tagged account

            verify(accountRepository).save(any(WalletAccount.class));
        }

        @Test
        @DisplayName("rejects purpose on a non-BANK_ACCOUNT type")
        void rejectsPurposeOnNonBankAccount() {
            CreateAccountRequest req = createRequest(AccountType.CASH_WALLET, BigDecimal.ZERO);
            when(req.getPurpose()).thenReturn(AccountPurpose.GENERAL_SAVINGS);

            assertThatThrownBy(() -> service.createAccount(userId, req)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).save(any());
        }

        @Test
        @DisplayName("CUSTOM purpose requires a non-blank label")
        void customPurposeRequiresLabel() {
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);
            when(req.getPurpose()).thenReturn(AccountPurpose.CUSTOM);
            when(req.getPurposeLabel()).thenReturn(null);

            assertThatThrownBy(() -> service.createAccount(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("CUSTOM purpose with a label is saved with both fields set")
        void customPurposeWithLabelSaved() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);
            when(req.getPurpose()).thenReturn(AccountPurpose.CUSTOM);
            when(req.getPurposeLabel()).thenReturn("Sabbatical");

            service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().getPurpose()).isEqualTo(AccountPurpose.CUSTOM);
            assertThat(captor.getValue().getPurposeLabel()).isEqualTo("Sabbatical");
        }

        @Test
        @DisplayName("credit-card-only fields are ignored when creating a non-credit-card account")
        void nonCreditCardFieldsIgnored() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);
            // Never actually read: isCC ? req.getCreditLimit() : null short-circuits before the
            // getter is even called for a non-credit-card type — that's exactly what's under test.
            lenient().when(req.getCreditLimit()).thenReturn(new BigDecimal("50000"));

            service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().getCreditLimit()).isNull();
        }

        @Test
        @DisplayName("a LOAN account's principalAmount defaults to the opening (outstanding) balance when omitted")
        void loanPrincipalDefaultsToOpeningBalance() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.LOAN, new BigDecimal("250000"));

            service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().getPrincipalAmount()).isEqualByComparingTo("250000");
        }

        @Test
        @DisplayName("a loan's autopay account must be a spendable (non-liability, non-investment) account")
        void rejectsLiabilityAutopayAccount() {
            UUID autopayId = UUID.randomUUID();
            WalletAccount liabilityAccount = WalletAccount.builder().userId(userId).accountType(AccountType.CREDIT_CARD).build();
            ReflectionTestUtils.setField(liabilityAccount, "id", autopayId);
            when(accountRepository.findByIdAndUserId(autopayId, userId)).thenReturn(Optional.of(liabilityAccount));
            CreateAccountRequest req = createRequest(AccountType.LOAN, new BigDecimal("100000"));
            when(req.getAutopayAccountId()).thenReturn(autopayId);

            assertThatThrownBy(() -> service.createAccount(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("the first bank account is automatically made primary; a later one is not")
        void firstBankAccountBecomesPrimary() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.BANK_ACCOUNT, LifecycleStatus.ACTIVE))
                    .thenReturn(false); // no existing bank account yet
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);

            service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().isPrimary()).isTrue();
        }

        @Test
        @DisplayName("a second bank account is NOT automatically made primary")
        void secondBankAccountNotAutoPrimary() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.BANK_ACCOUNT, LifecycleStatus.ACTIVE))
                    .thenReturn(true); // already has one
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);

            service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().isPrimary()).isFalse();
        }

        @Test
        @DisplayName("excludeFromNetWorth carries through onto the created account")
        void excludeFromNetWorthCarriesThrough() {
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, BigDecimal.ZERO);
            when(req.isExcludeFromNetWorth()).thenReturn(true);

            AccountResponse response = service.createAccount(userId, req);

            ArgumentCaptor<WalletAccount> captor = ArgumentCaptor.forClass(WalletAccount.class);
            verify(accountRepository).save(captor.capture());
            assertThat(captor.getValue().isExcludeFromNetWorth()).isTrue();
            assertThat(response.isExcludeFromNetWorth()).isTrue();
        }
    }

    // ─── archiveAccount / unarchiveAccount ───────────────────────────────────────

    @Nested
    @DisplayName("archiveAccount / unarchiveAccount / closeAccount")
    class ArchiveTests {

        @Test
        @DisplayName("archiving an ACTIVE account sets status=ARCHIVED")
        void archiveSetsStatus() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> inv.getArgument(0));

            service.archiveAccount(accountId, userId);

            assertThat(account.getStatus()).isEqualTo(LifecycleStatus.ARCHIVED);
        }

        @Test
        @DisplayName("archiving a CLOSED account is rejected — CLOSED is a different, terminal bucket")
        void archiveRejectsClosedAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).status(LifecycleStatus.CLOSED).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> service.archiveAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).save(any());
        }

        @Test
        @DisplayName("unarchiving a singleton type is blocked while another active one of the same type exists")
        void unarchiveBlockedBySingletonConflict() {
            WalletAccount account = withId(baseAccount(AccountType.CASH_WALLET).status(LifecycleStatus.ARCHIVED).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.CASH_WALLET, LifecycleStatus.ACTIVE)).thenReturn(true);

            assertThatThrownBy(() -> service.unarchiveAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            assertThat(account.getStatus()).isEqualTo(LifecycleStatus.ARCHIVED); // unchanged
        }

        @Test
        @DisplayName("unarchiving succeeds when no conflicting active singleton exists")
        void unarchiveSucceedsWithoutConflict() {
            WalletAccount account = withId(baseAccount(AccountType.CASH_WALLET).status(LifecycleStatus.ARCHIVED).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.existsByUserIdAndAccountTypeAndStatus(userId, AccountType.CASH_WALLET, LifecycleStatus.ACTIVE)).thenReturn(false);
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> inv.getArgument(0));

            service.unarchiveAccount(accountId, userId);

            assertThat(account.getStatus()).isEqualTo(LifecycleStatus.ACTIVE);
        }

        @Test
        @DisplayName("closing an ACTIVE account sets status=CLOSED")
        void closeSetsStatus() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> inv.getArgument(0));

            service.closeAccount(accountId, userId);

            assertThat(account.getStatus()).isEqualTo(LifecycleStatus.CLOSED);
        }

        @Test
        @DisplayName("closing an already-CLOSED or ARCHIVED account is rejected — only ACTIVE can be closed")
        void closeRejectsNonActiveAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).status(LifecycleStatus.ARCHIVED).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> service.closeAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).save(any());
        }
    }

    // ─── transfer ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("transfer")
    class TransferTests {

        private TransferRequest req(UUID from, UUID to, BigDecimal amount) {
            TransferRequest r = mock(TransferRequest.class);
            lenient().when(r.getFromAccountId()).thenReturn(from);
            lenient().when(r.getToAccountId()).thenReturn(to);
            lenient().when(r.getAmount()).thenReturn(amount);
            lenient().when(r.getDescription()).thenReturn("Test transfer");
            lenient().when(r.getTransferDate()).thenReturn(LocalDate.now());
            return r;
        }

        @Test
        @DisplayName("rejects a transfer to the same account")
        void rejectsSameAccountTransfer() {
            TransferRequest r = req(accountId, accountId, new BigDecimal("100"));
            assertThatThrownBy(() -> service.transfer(userId, r)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(accountBalanceGuard);
        }

        @Test
        @DisplayName("validates sufficient balance on the source account before transferring")
        void validatesSourceBalance() {
            UUID toId = UUID.randomUUID();
            WalletAccount from = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            WalletAccount to = baseAccount(AccountType.BANK_ACCOUNT).build();
            ReflectionTestUtils.setField(to, "id", toId);
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(from));
            when(accountRepository.findById(toId)).thenReturn(Optional.of(to));
            when(transferRepository.save(any(AccountTransfer.class))).thenAnswer(inv -> {
                AccountTransfer t = inv.getArgument(0);
                ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
                return t;
            });

            TransferResponse response = service.transfer(userId, req(accountId, toId, new BigDecimal("200")));

            verify(accountBalanceGuard).validateSufficientBalance(accountId, userId, new BigDecimal("200"), BigDecimal.ZERO);
            assertThat(response.getAmount()).isEqualByComparingTo("200");
        }

        @Test
        @DisplayName("triggers a low-balance check on the source account after a successful transfer")
        void triggersLowBalanceCheckAfterTransfer() {
            UUID toId = UUID.randomUUID();
            WalletAccount from = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .lowBalanceThreshold(new BigDecimal("500")).openingBalance(new BigDecimal("100")).build());
            WalletAccount to = baseAccount(AccountType.BANK_ACCOUNT).build();
            ReflectionTestUtils.setField(to, "id", toId);
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(from));
            when(accountRepository.findById(toId)).thenReturn(Optional.of(to));
            when(transferRepository.save(any(AccountTransfer.class))).thenAnswer(inv -> {
                AccountTransfer t = inv.getArgument(0);
                ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
                return t;
            });

            service.transfer(userId, req(accountId, toId, new BigDecimal("50")));

            verify(notificationService).createLowBalanceNotification(eq(userId), eq("Test Account"), any(), eq(new BigDecimal("500")));
        }
    }

    // ─── adjustBalance ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("adjustBalance")
    class AdjustBalanceTests {

        @Test
        @DisplayName("rejects a negative target balance for a non-liability (asset) account")
        void rejectsNegativeForAssetAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> service.adjustBalance(accountId, userId, new BigDecimal("-10")))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("allows a negative target balance for a liability account (it's normal to still owe money)")
        void allowsNegativeForLiabilityAccount() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).openingBalance(BigDecimal.ZERO).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            // current balance is 0 (no activity); target -10 means diff=-10, should not throw
            service.adjustBalance(accountId, userId, new BigDecimal("-10"));

            verify(transferRepository).save(any(AccountTransfer.class));
        }

        @Test
        @DisplayName("is a no-op (no transfer created) when the target already equals the current balance")
        void noOpWhenTargetEqualsCurrent() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).openingBalance(new BigDecimal("1000")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.adjustBalance(accountId, userId, new BigDecimal("1000"));

            verify(transferRepository, never()).save(any());
        }

        @Test
        @DisplayName("raising an ASSET account's balance routes as an incoming transfer (toAccountId = this account)")
        void assetIncreaseRoutesAsIncomingTransfer() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).openingBalance(new BigDecimal("1000")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.adjustBalance(accountId, userId, new BigDecimal("1500")); // +500

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            assertThat(captor.getValue().getToAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getFromAccountId()).isNull();
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("500");
        }

        @Test
        @DisplayName("lowering an ASSET account's balance routes as an outgoing transfer (fromAccountId = this account)")
        void assetDecreaseRoutesAsOutgoingTransfer() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).openingBalance(new BigDecimal("1000")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.adjustBalance(accountId, userId, new BigDecimal("700")); // -300

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            assertThat(captor.getValue().getFromAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getToAccountId()).isNull();
        }

        @Test
        @DisplayName("raising a LIABILITY account's outstanding routes as an OUTGOING transfer (mirror image of asset)")
        void liabilityIncreaseRoutesAsOutgoingTransfer() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).openingBalance(new BigDecimal("1000")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.adjustBalance(accountId, userId, new BigDecimal("1500")); // outstanding +500

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            assertThat(captor.getValue().getFromAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getToAccountId()).isNull();
        }

        @Test
        @DisplayName("lowering a LIABILITY account's outstanding (an unlogged payment) routes as an INCOMING transfer")
        void liabilityDecreaseRoutesAsIncomingTransfer() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).openingBalance(new BigDecimal("1000")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.adjustBalance(accountId, userId, new BigDecimal("600")); // outstanding -400

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            assertThat(captor.getValue().getToAccountId()).isEqualTo(accountId);
            assertThat(captor.getValue().getFromAccountId()).isNull();
        }
    }

    // ─── setPrimary ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("setPrimary")
    class SetPrimaryTests {

        @Test
        @DisplayName("rejects non-bank-account types")
        void rejectsNonBankAccount() {
            WalletAccount account = withId(baseAccount(AccountType.CASH_WALLET).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            assertThatThrownBy(() -> service.setPrimary(accountId, userId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("clears any existing primary bank account before setting the new one")
        void clearsExistingPrimaryFirst() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).primary(false).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any(WalletAccount.class))).thenAnswer(inv -> inv.getArgument(0));

            service.setPrimary(accountId, userId);

            verify(accountRepository).clearPrimaryForType(userId, AccountType.BANK_ACCOUNT);
            assertThat(account.isPrimary()).isTrue();
        }
    }

    // ─── checkLowBalance ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("checkLowBalance")
    class CheckLowBalanceTests {

        @Test
        @DisplayName("does nothing when no threshold is configured")
        void noOpWithoutThreshold() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).lowBalanceThreshold(null).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.checkLowBalance(accountId, userId);

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("does nothing for liability accounts even with a threshold set")
        void noOpForLiabilityAccounts() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).lowBalanceThreshold(new BigDecimal("100")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.checkLowBalance(accountId, userId);

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("silently swallows any exception rather than propagating it to the caller")
        void swallowsExceptions() {
            when(accountRepository.findById(accountId)).thenThrow(new RuntimeException("DB blip"));

            service.checkLowBalance(accountId, userId); // must not throw
        }

        @Test
        @DisplayName("does nothing when the account belongs to a different user (defense in depth)")
        void noOpForForeignAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).userId(UUID.randomUUID())
                    .lowBalanceThreshold(new BigDecimal("100")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            service.checkLowBalance(accountId, userId);

            verifyNoInteractions(notificationService);
        }
    }

    // ─── findAndValidate ownership (via getCurrentBalance) ──────────────────────

    @Nested
    @DisplayName("ownership validation")
    class OwnershipTests {

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown account")
        void throwsWhenNotFound() {
            when(accountRepository.findById(accountId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getCurrentBalance(accountId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's account")
        void throwsWhenNotOwned() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).userId(UUID.randomUUID()).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            assertThatThrownBy(() -> service.getCurrentBalance(accountId, userId))
                    .isInstanceOf(AccessDeniedException.class);
        }
    }

    // ─── updateAccount ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateAccount")
    class UpdateAccountTests {

        @Test
        @DisplayName("null optional fields on the request leave the existing values untouched, " +
                "except accountNumber/lowBalanceThreshold (see their own tests below — a null there " +
                "is a deliberate clear)")
        void nullFieldsLeaveExistingValuesUntouched() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).bankName("HDFC").build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            when(req.getName()).thenReturn("Renamed");

            AccountResponse response = service.updateAccount(accountId, userId, req);

            assertThat(response.getName()).isEqualTo("Renamed");
            assertThat(account.getBankName()).isEqualTo("HDFC");
        }

        @Test
        @DisplayName("a non-null accountNumber on the request overwrites the existing value")
        void accountNumberIsUpdatedWhenRequestCarriesANewValue() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .bankName("HDFC").accountNumber("1234").build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            when(req.getAccountNumber()).thenReturn("5678");

            AccountResponse response = service.updateAccount(accountId, userId, req);

            assertThat(account.getAccountNumber()).isEqualTo("5678");
            assertThat(response.getAccountNumber()).isEqualTo("5678");
        }

        @Test
        @DisplayName("accountNumber is cleared when the request omits it — unlike bankName (required, so it " +
                "can never legitimately arrive blank), the edit form always submits its current value for " +
                "this optional field, so a null here is a deliberate clear, not 'leave unchanged'")
        void accountNumberIsClearedWhenRequestOmitsIt() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .bankName("HDFC").accountNumber("1234").build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            // createRequest()'s getAccountNumber() defaults to null — matches what submitting the
            // edit form with the account number field cleared out actually sends.
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);

            AccountResponse response = service.updateAccount(accountId, userId, req);

            assertThat(account.getAccountNumber()).isNull();
            assertThat(response.getAccountNumber()).isNull();
        }

        @Test
        @DisplayName("a non-null lowBalanceThreshold on the request overwrites the existing value")
        void lowBalanceThresholdIsUpdatedWhenRequestCarriesANewValue() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .lowBalanceThreshold(new BigDecimal("500")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            when(req.getLowBalanceThreshold()).thenReturn(new BigDecimal("1000"));

            service.updateAccount(accountId, userId, req);

            assertThat(account.getLowBalanceThreshold()).isEqualByComparingTo("1000");
        }

        @Test
        @DisplayName("lowBalanceThreshold is cleared (alert turned off) when the request omits it — the edit " +
                "form always submits its current value for this optional field, so a null here is a " +
                "deliberate clear, not 'leave unchanged'")
        void lowBalanceThresholdIsClearedWhenRequestOmitsIt() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .lowBalanceThreshold(new BigDecimal("500")).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            // createRequest()'s getLowBalanceThreshold() defaults to null — matches what submitting
            // the edit form with the alert field cleared out actually sends.
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);

            service.updateAccount(accountId, userId, req);

            assertThat(account.getLowBalanceThreshold()).isNull();
        }

        @Test
        @DisplayName("excludeFromNetWorth is always synced from the request, like lowBalanceThreshold — " +
                "the edit form's checkbox always submits its current state")
        void excludeFromNetWorthIsAlwaysSynced() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).excludeFromNetWorth(false).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            when(req.isExcludeFromNetWorth()).thenReturn(true);

            service.updateAccount(accountId, userId, req);

            assertThat(account.isExcludeFromNetWorth()).isTrue();
        }

        @Test
        @DisplayName("purpose is cleared when the request carries no purpose — unlike the other optional " +
                "fields above, a null here is a deliberate 'None' clear, not 'leave unchanged'")
        void purposeIsClearedWhenRequestOmitsIt() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT)
                    .purpose(AccountPurpose.GENERAL_SAVINGS).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            // createRequest()'s getPurpose()/getPurposeLabel() default to null — matches what a
            // "None" pick in the Purpose picker actually submits.
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);

            service.updateAccount(accountId, userId, req);

            assertThat(account.getPurpose()).isNull();
            assertThat(account.getPurposeLabel()).isNull();
        }

        @Test
        @DisplayName("purpose is set on update when the request carries one")
        void purposeIsSetOnUpdate() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            when(req.getPurpose()).thenReturn(AccountPurpose.GENERAL_SAVINGS);

            service.updateAccount(accountId, userId, req);

            assertThat(account.getPurpose()).isEqualTo(AccountPurpose.GENERAL_SAVINGS);
        }

        @Test
        @DisplayName("purpose on the request is ignored (never touched) for a non-BANK_ACCOUNT type")
        void purposeIgnoredForNonBankAccount() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.CREDIT_CARD, null);
            // isCC is true, so the purpose branch (BANK_ACCOUNT-only) never fires regardless.
            lenient().when(req.getPurpose()).thenReturn(AccountPurpose.GENERAL_SAVINGS);

            service.updateAccount(accountId, userId, req);

            assertThat(account.getPurpose()).isNull();
        }

        @Test
        @DisplayName("credit-card fields are only applied when the account is actually a credit card")
        void creditCardFieldsIgnoredForNonCreditCardAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.BANK_ACCOUNT, null);
            // isCC is false for a bank account, so updateAccount short-circuits before ever reading
            // these getters — lenient because the point of this test is that they're never called.
            lenient().when(req.getCreditLimit()).thenReturn(new BigDecimal("50000"));
            lenient().when(req.getStatementDay()).thenReturn(5);
            lenient().when(req.getPaymentDueDay()).thenReturn(20);
            lenient().when(req.getApr()).thenReturn(new BigDecimal("18"));

            service.updateAccount(accountId, userId, req);

            assertThat(account.getCreditLimit()).isNull();
            assertThat(account.getStatementDay()).isNull();
            assertThat(account.getPaymentDueDay()).isNull();
            assertThat(account.getApr()).isNull();
        }

        @Test
        @DisplayName("credit-card fields (including shared APR) are applied when the account is a credit card")
        void creditCardFieldsAppliedForCreditCardAccount() {
            WalletAccount account = withId(baseAccount(AccountType.CREDIT_CARD).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.CREDIT_CARD, null);
            when(req.getCreditLimit()).thenReturn(new BigDecimal("50000"));
            when(req.getStatementDay()).thenReturn(5);
            when(req.getPaymentDueDay()).thenReturn(20);
            when(req.getApr()).thenReturn(new BigDecimal("18"));

            service.updateAccount(accountId, userId, req);

            assertThat(account.getCreditLimit()).isEqualByComparingTo("50000");
            assertThat(account.getStatementDay()).isEqualTo(5);
            assertThat(account.getPaymentDueDay()).isEqualTo(20);
            assertThat(account.getApr()).isEqualByComparingTo("18");
        }

        @Test
        @DisplayName("loan fields (including shared APR) are applied when the account is a loan, and a bad autopay account is rejected")
        void loanFieldsAppliedAndAutopayValidated() {
            WalletAccount account = withId(baseAccount(AccountType.LOAN).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            CreateAccountRequest req = createRequest(AccountType.LOAN, null);
            when(req.getApr()).thenReturn(new BigDecimal("9.5"));
            UUID autopayId = UUID.randomUUID();
            when(req.getAutopayAccountId()).thenReturn(autopayId);
            WalletAccount liabilityAccount = WalletAccount.builder()
                    .userId(userId).accountType(AccountType.CREDIT_CARD).build();
            ReflectionTestUtils.setField(liabilityAccount, "id", autopayId);
            when(accountRepository.findByIdAndUserId(autopayId, userId)).thenReturn(Optional.of(liabilityAccount));

            assertThatThrownBy(() -> service.updateAccount(accountId, userId, req))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("cash or bank account");
        }

        @Test
        @DisplayName("a valid autopay account is applied and the loan's APR is set")
        void validAutopayAccountApplied() {
            WalletAccount account = withId(baseAccount(AccountType.LOAN).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            when(accountRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            CreateAccountRequest req = createRequest(AccountType.LOAN, null);
            when(req.getApr()).thenReturn(new BigDecimal("9.5"));
            UUID autopayId = UUID.randomUUID();
            when(req.getAutopayAccountId()).thenReturn(autopayId);
            WalletAccount bankAccount = WalletAccount.builder()
                    .userId(userId).accountType(AccountType.BANK_ACCOUNT).build();
            ReflectionTestUtils.setField(bankAccount, "id", autopayId);
            when(accountRepository.findByIdAndUserId(autopayId, userId)).thenReturn(Optional.of(bankAccount));

            service.updateAccount(accountId, userId, req);

            assertThat(account.getApr()).isEqualByComparingTo("9.5");
            assertThat(account.getAutopayAccountId()).isEqualTo(autopayId);
        }
    }

    // ─── deleteAccount ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteAccount")
    class DeleteAccountTests {

        private WalletAccount stubZeroHistoryAccount() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
            lenient().when(expenseRepository.existsByAccountId(accountId)).thenReturn(false);
            lenient().when(incomeRepository.existsByAccountId(accountId)).thenReturn(false);
            lenient().when(transferRepository.findByAccountId(accountId)).thenReturn(List.of());
            lenient().when(investmentRepository.existsByDebitAccountId(accountId)).thenReturn(false);
            lenient().when(investmentRepository.existsByLinkedAccountId(accountId)).thenReturn(false);
            lenient().when(goalRepository.existsByAccountId(accountId)).thenReturn(false);
            return account;
        }

        @Test
        @DisplayName("deletes outright when the account has zero history of any kind")
        void deletesWhenNoHistory() {
            WalletAccount account = stubZeroHistoryAccount();

            service.deleteAccount(accountId, userId);

            verify(accountRepository).delete(account);
        }

        @Test
        @DisplayName("rejects deletion when the account has expense history")
        void rejectsWhenExpenseHistoryExists() {
            stubZeroHistoryAccount();
            when(expenseRepository.existsByAccountId(accountId)).thenReturn(true);

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }

        @Test
        @DisplayName("rejects deletion when the account has income history")
        void rejectsWhenIncomeHistoryExists() {
            stubZeroHistoryAccount();
            when(incomeRepository.existsByAccountId(accountId)).thenReturn(true);

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }

        @Test
        @DisplayName("rejects deletion when the account has transfer history")
        void rejectsWhenTransferHistoryExists() {
            stubZeroHistoryAccount();
            AccountTransfer t = AccountTransfer.builder().userId(userId).fromAccountId(accountId).amount(BigDecimal.TEN).build();
            when(transferRepository.findByAccountId(accountId)).thenReturn(List.of(t));

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }

        @Test
        @DisplayName("rejects deletion when an investment is funded from this account")
        void rejectsWhenInvestmentDebitLinkExists() {
            stubZeroHistoryAccount();
            when(investmentRepository.existsByDebitAccountId(accountId)).thenReturn(true);

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }

        @Test
        @DisplayName("rejects deletion when an investment credits income to this account")
        void rejectsWhenInvestmentLinkedAccountExists() {
            stubZeroHistoryAccount();
            when(investmentRepository.existsByLinkedAccountId(accountId)).thenReturn(true);

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }

        @Test
        @DisplayName("rejects deletion when a goal is linked to this account")
        void rejectsWhenGoalLinkExists() {
            stubZeroHistoryAccount();
            when(goalRepository.existsByAccountId(accountId)).thenReturn(true);

            assertThatThrownBy(() -> service.deleteAccount(accountId, userId)).isInstanceOf(BusinessException.class);
            verify(accountRepository, never()).delete(any());
        }
    }

    // ─── updateTransfer ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateTransfer")
    class UpdateTransferTests {

        @Test
        @DisplayName("re-validates sufficient balance only when the amount actually changes")
        void revalidatesBalanceOnlyWhenAmountChanges() {
            UUID transferId = UUID.randomUUID();
            UUID fromId = UUID.randomUUID(), toId = UUID.randomUUID();
            AccountTransfer t = AccountTransfer.builder().userId(userId).fromAccountId(fromId).toAccountId(toId)
                    .amount(new BigDecimal("100")).build();
            ReflectionTestUtils.setField(t, "id", transferId);
            when(transferRepository.findById(transferId)).thenReturn(Optional.of(t));
            when(transferRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());
            UpdateTransferRequest req = mock(UpdateTransferRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("200"));
            lenient().when(req.getTransferDate()).thenReturn(null);
            lenient().when(req.getDescription()).thenReturn(null);

            service.updateTransfer(transferId, userId, req);

            verify(accountBalanceGuard).validateSufficientBalance(fromId, userId, new BigDecimal("200"), new BigDecimal("100"));
        }

        @Test
        @DisplayName("skips balance revalidation when only the description/date change, not the amount")
        void skipsRevalidationWhenAmountUnchanged() {
            UUID transferId = UUID.randomUUID();
            AccountTransfer t = AccountTransfer.builder().userId(userId)
                    .fromAccountId(UUID.randomUUID()).toAccountId(UUID.randomUUID())
                    .amount(new BigDecimal("100")).build();
            ReflectionTestUtils.setField(t, "id", transferId);
            when(transferRepository.findById(transferId)).thenReturn(Optional.of(t));
            when(transferRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of());
            UpdateTransferRequest req = mock(UpdateTransferRequest.class);
            lenient().when(req.getAmount()).thenReturn(null);
            lenient().when(req.getDescription()).thenReturn("Updated note");
            lenient().when(req.getTransferDate()).thenReturn(null);

            service.updateTransfer(transferId, userId, req);

            verifyNoInteractions(accountBalanceGuard);
            assertThat(t.getDescription()).isEqualTo("Updated note");
        }

        @Test
        @DisplayName("resolves account names from a fresh lookup, falling back to \"Unknown\" for a deleted account")
        void resolvesNamesWithUnknownFallback() {
            UUID transferId = UUID.randomUUID();
            UUID fromId = UUID.randomUUID();
            UUID deletedToId = UUID.randomUUID(); // a real id, but absent from the current accounts list
            AccountTransfer t = AccountTransfer.builder().userId(userId)
                    .fromAccountId(fromId).toAccountId(deletedToId)
                    .amount(new BigDecimal("100")).build();
            ReflectionTestUtils.setField(t, "id", transferId);
            when(transferRepository.findById(transferId)).thenReturn(Optional.of(t));
            when(transferRepository.save(any())).thenAnswer(a -> a.getArgument(0));
            WalletAccount from = WalletAccount.builder().userId(userId).name("Checking").build();
            ReflectionTestUtils.setField(from, "id", fromId);
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(from));
            UpdateTransferRequest req = mock(UpdateTransferRequest.class);
            lenient().when(req.getAmount()).thenReturn(null);
            lenient().when(req.getDescription()).thenReturn(null);
            lenient().when(req.getTransferDate()).thenReturn(null);

            TransferResponse response = service.updateTransfer(transferId, userId, req);

            assertThat(response.getFromAccountName()).isEqualTo("Checking");
            assertThat(response.getToAccountName()).isEqualTo("Unknown");
        }
    }

    // ─── getAccountsForUsers ────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAccountsForUsers")
    class GetAccountsForUsersTests {

        @Test
        @DisplayName("returns an empty list without querying the repository when userIds is empty")
        void emptyUserIdsShortCircuits() {
            assertThat(service.getAccountsForUsers(List.of())).isEmpty();
            verifyNoInteractions(accountRepository);
        }

        @Test
        @DisplayName("delegates to findByUserIdInAndStatusNot(ARCHIVED) and enriches the batch")
        void delegatesAndEnriches() {
            WalletAccount account = withId(baseAccount(AccountType.BANK_ACCOUNT).build());
            when(accountRepository.findByUserIdInAndStatusNot(List.of(userId), LifecycleStatus.ARCHIVED)).thenReturn(List.of(account));
            when(incomeRepository.sumByAccountIdsGrouped(any())).thenReturn(List.of());
            when(expenseRepository.sumByAccountIdsGrouped(any())).thenReturn(List.of());
            when(transferRepository.sumTransfersInGrouped(any())).thenReturn(List.of());
            when(transferRepository.sumTransfersOutGrouped(any())).thenReturn(List.of());
            when(transferRepository.sumRegularTransfersInGrouped(any())).thenReturn(List.of());
            when(transferRepository.sumRegularTransfersOutGrouped(any())).thenReturn(List.of());
            when(incomeRepository.sumRegularByAccountIdsGrouped(any())).thenReturn(List.of());
            when(expenseRepository.sumRegularByAccountIdsGrouped(any())).thenReturn(List.of());

            List<AccountResponse> result = service.getAccountsForUsers(List.of(userId));

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(accountId);
        }
    }

    // ─── enrich(): credit-card and loan date computations (via getAccounts) ─────

    @Nested
    @DisplayName("enrich: credit-card and loan next-date computations")
    class EnrichDateComputationTests {

        @Test
        @DisplayName("credit card: nextStatementDate uses this month when today is before the statement day")
        void creditCardStatementDateThisMonthWhenBeforeDay() {
            LocalDate today = LocalDate.now();
            int futureDay = today.lengthOfMonth(); // last day of month is always >= today's day
            org.junit.jupiter.api.Assumptions.assumeTrue(futureDay > today.getDayOfMonth());
            WalletAccount card = withId(baseAccount(AccountType.CREDIT_CARD)
                    .statementDay(futureDay).paymentDueDay(5).creditLimit(new BigDecimal("100000")).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(card));

            AccountResponse response = service.getAccounts(userId).get(0);

            assertThat(response.getNextStatementDate()).isEqualTo(today.withDayOfMonth(futureDay));
            assertThat(response.getNextDueDate()).isEqualTo(today.withDayOfMonth(futureDay).plusMonths(1).withDayOfMonth(5));
            assertThat(response.getAvailableCredit()).isNotNull();
        }

        @Test
        @DisplayName("credit card: nextStatementDate rolls to next month when today is on/after the statement day")
        void creditCardStatementDateRollsToNextMonth() {
            WalletAccount card = withId(baseAccount(AccountType.CREDIT_CARD)
                    .statementDay(1).creditLimit(new BigDecimal("100000")).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(card));

            AccountResponse response = service.getAccounts(userId).get(0);

            LocalDate today = LocalDate.now();
            LocalDate expected = today.getDayOfMonth() < 1 ? today.withDayOfMonth(1) : today.plusMonths(1).withDayOfMonth(1);
            assertThat(response.getNextStatementDate()).isEqualTo(expected);
        }

        @Test
        @DisplayName("credit card: availableCredit is null when no creditLimit is configured")
        void creditCardAvailableCreditNullWithoutLimit() {
            WalletAccount card = withId(baseAccount(AccountType.CREDIT_CARD).creditLimit(null).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(card));

            AccountResponse response = service.getAccounts(userId).get(0);

            assertThat(response.getAvailableCredit()).isNull();
        }

        @Test
        @DisplayName("loan: nextEmiDate is null once the outstanding balance reaches zero, even with an emiDay set")
        void loanNextEmiDateNullWhenPaidOff() {
            WalletAccount loan = withId(baseAccount(AccountType.LOAN).openingBalance(BigDecimal.ZERO).emiDay(5).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(loan));

            AccountResponse response = service.getAccounts(userId).get(0);

            assertThat(response.getNextEmiDate()).isNull();
        }

        @Test
        @DisplayName("loan: resolves the autopay account's name when one is linked")
        void loanResolvesAutopayAccountName() {
            UUID autopayId = UUID.randomUUID();
            WalletAccount loan = withId(baseAccount(AccountType.LOAN).emiDay(5).autopayAccountId(autopayId).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(loan));
            WalletAccount autopay = WalletAccount.builder().userId(userId).name("Salary Account").build();
            when(accountRepository.findById(autopayId)).thenReturn(Optional.of(autopay));

            AccountResponse response = service.getAccounts(userId).get(0);

            assertThat(response.getAutopayAccountName()).isEqualTo("Salary Account");
            assertThat(response.getNextEmiDate()).isNotNull();
        }

        @Test
        @DisplayName("loan: autopayAccountName is null when no autopay account is linked")
        void loanAutopayNameNullWithoutLink() {
            WalletAccount loan = withId(baseAccount(AccountType.LOAN).emiDay(5).autopayAccountId(null).build());
            when(accountRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(loan));

            AccountResponse response = service.getAccounts(userId).get(0);

            assertThat(response.getAutopayAccountName()).isNull();
        }
    }

}
