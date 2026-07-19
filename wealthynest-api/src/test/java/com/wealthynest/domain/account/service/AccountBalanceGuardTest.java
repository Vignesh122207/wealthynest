package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountBalanceGuardTest {

    @Mock private WalletAccountRepository   accountRepository;
    @Mock private IncomeRepository          incomeRepository;
    @Mock private ExpenseRepository         expenseRepository;
    @Mock private AccountTransferRepository transferRepository;

    private AccountBalanceGuard guard;

    private final UUID accountId = UUID.randomUUID();
    private final UUID userId    = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        guard = new AccountBalanceGuard(accountRepository, incomeRepository, expenseRepository, transferRepository);
    }

    private WalletAccount withId(WalletAccount account) {
        ReflectionTestUtils.setField(account, "id", accountId);
        return account;
    }

    private void stubZeroActivity() {
        lenient().when(incomeRepository.sumByAccountId(accountId)).thenReturn(BigDecimal.ZERO);
        lenient().when(expenseRepository.sumByAccountId(accountId)).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumTransfersIn(accountId)).thenReturn(BigDecimal.ZERO);
        lenient().when(transferRepository.sumTransfersOut(accountId)).thenReturn(BigDecimal.ZERO);
    }

    @Test
    void doesNothingWhenAccountIdIsNull() {
        assertThatCode(() -> guard.validateSufficientBalance(null, userId, BigDecimal.TEN, BigDecimal.ZERO))
                .doesNotThrowAnyException();
        verify(accountRepository, never()).findByIdAndUserIdForUpdate(any(), any());
    }

    @Test
    void doesNothingWhenAmountIsNull() {
        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, null, BigDecimal.ZERO))
                .doesNotThrowAnyException();
        verify(accountRepository, never()).findByIdAndUserIdForUpdate(any(), any());
    }

    @Test
    void throwsResourceNotFoundWhenAccountMissing() {
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guard.validateSufficientBalance(accountId, userId, BigDecimal.TEN, BigDecimal.ZERO))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void allowsLoanAccountRegardlessOfBalance() {
        WalletAccount loan = withId(WalletAccount.builder().userId(userId).accountType(AccountType.LOAN)
                .name("Home Loan").openingBalance(new BigDecimal("500000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(loan));
        stubZeroActivity();

        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("100000"), BigDecimal.ZERO))
                .doesNotThrowAnyException();
    }

    @Test
    void creditCardWithNoLimitConfiguredIsUnrestricted() {
        WalletAccount card = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CREDIT_CARD)
                .name("Card").openingBalance(BigDecimal.ZERO).creditLimit(null).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(card));
        stubZeroActivity();

        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("999999"), BigDecimal.ZERO))
                .doesNotThrowAnyException();
    }

    @Test
    void creditCardSpendWithinLimitPasses() {
        WalletAccount card = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CREDIT_CARD)
                .name("Card").openingBalance(BigDecimal.ZERO).creditLimit(new BigDecimal("1000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(card));
        stubZeroActivity();

        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("500"), BigDecimal.ZERO))
                .doesNotThrowAnyException();
    }

    @Test
    void creditCardSpendExceedingLimitThrows() {
        WalletAccount card = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CREDIT_CARD)
                .name("Card").openingBalance(BigDecimal.ZERO).creditLimit(new BigDecimal("1000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(card));
        stubZeroActivity();
        // outstanding already 900 (via expenses), new spend of 200 -> 1100 > 1000 limit
        when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("900"));

        assertThatThrownBy(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("200"), BigDecimal.ZERO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("credit limit");
    }

    @Test
    void creditCardEditDoesNotDoubleCountThePreviousAmount() {
        WalletAccount card = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CREDIT_CARD)
                .name("Card").openingBalance(BigDecimal.ZERO).creditLimit(new BigDecimal("1000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(card));
        stubZeroActivity();
        // outstanding already includes the old 900; editing that same expense to 950 nets to 950, under 1000
        when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("900"));

        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("950"), new BigDecimal("900")))
                .doesNotThrowAnyException();
    }

    @Test
    void spendableAccountWithSufficientBalancePasses() {
        WalletAccount wallet = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CASH_WALLET)
                .name("Wallet").openingBalance(new BigDecimal("1000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(wallet));
        stubZeroActivity();

        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("500"), BigDecimal.ZERO))
                .doesNotThrowAnyException();
    }

    @Test
    void spendableAccountDrivenNegativeThrows() {
        WalletAccount wallet = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CASH_WALLET)
                .name("Wallet").openingBalance(new BigDecimal("100")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(wallet));
        stubZeroActivity();

        assertThatThrownBy(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("500"), BigDecimal.ZERO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Insufficient balance");
    }

    @Test
    void spendableAccountEditDoesNotDoubleCountThePreviousAmount() {
        WalletAccount wallet = withId(WalletAccount.builder().userId(userId).accountType(AccountType.CASH_WALLET)
                .name("Wallet").openingBalance(new BigDecimal("1000")).build());
        when(accountRepository.findByIdAndUserIdForUpdate(accountId, userId)).thenReturn(Optional.of(wallet));
        stubZeroActivity();
        when(expenseRepository.sumByAccountId(accountId)).thenReturn(new BigDecimal("500"));

        // balance is already net of the old 500; editing that same expense up to 900 leaves 600 available
        assertThatCode(() -> guard.validateSufficientBalance(accountId, userId, new BigDecimal("900"), new BigDecimal("500")))
                .doesNotThrowAnyException();
    }
}
