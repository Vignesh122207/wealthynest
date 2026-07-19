package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LoanPaymentServiceTest {

    @Mock private WalletAccountRepository   accountRepository;
    @Mock private AccountTransferRepository transferRepository;
    @Mock private ExpenseRepository         expenseRepository;
    @Mock private WalletAccountService      walletAccountService;

    private LoanPaymentService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID loanId = UUID.randomUUID();
    private final UUID fromAccountId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new LoanPaymentService(accountRepository, transferRepository, expenseRepository, walletAccountService);
    }

    private WalletAccount withId(WalletAccount account, UUID id) {
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }

    private WalletAccount loanAccount(BigDecimal apr) {
        return withId(WalletAccount.builder().userId(userId).accountType(AccountType.LOAN)
                .name("Home Loan").bankName("HDFC").openingBalance(new BigDecimal("500000")).apr(apr).build(), loanId);
    }

    private WalletAccount spendableFromAccount() {
        return withId(WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                .name("Salary Account").openingBalance(new BigDecimal("100000")).build(), fromAccountId);
    }

    @Test
    void throwsResourceNotFoundWhenLoanMissing() {
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recordPayment(loanId, userId, BigDecimal.TEN, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void throwsWhenAccountIsNotALoan() {
        WalletAccount notALoan = withId(WalletAccount.builder().userId(userId).accountType(AccountType.BANK_ACCOUNT)
                .name("Bank").openingBalance(BigDecimal.ZERO).build(), loanId);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(notALoan));

        assertThatThrownBy(() -> service.recordPayment(loanId, userId, BigDecimal.TEN, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("loan accounts");
    }

    @Test
    void throwsWhenAmountIsNotPositive() {
        WalletAccount loan = loanAccount(null);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));

        assertThatThrownBy(() -> service.recordPayment(loanId, userId, BigDecimal.ZERO, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("positive");
    }

    @Test
    void throwsWhenPayingFromAnotherLiabilityAccount() {
        WalletAccount loan = loanAccount(null);
        WalletAccount anotherLoan = withId(WalletAccount.builder().userId(userId).accountType(AccountType.LOAN)
                .name("Car Loan").openingBalance(new BigDecimal("50000")).build(), fromAccountId);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        when(accountRepository.findByIdAndUserId(fromAccountId, userId)).thenReturn(Optional.of(anotherLoan));

        assertThatThrownBy(() -> service.recordPayment(loanId, userId, BigDecimal.TEN, fromAccountId))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("liability account");
    }

    @Test
    void throwsWhenLoanAlreadyFullyPaid() {
        WalletAccount loan = loanAccount(null);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(BigDecimal.ZERO);

        assertThatThrownBy(() -> service.recordPayment(loanId, userId, BigDecimal.TEN, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("fully paid");
    }

    @Test
    void wholePaymentIsPrincipalWhenNoAprSet() {
        WalletAccount loan = loanAccount(null);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(new BigDecimal("500000"));

        LoanPaymentService.AccountResult result = service.recordPayment(loanId, userId, new BigDecimal("10000"), null);

        assertThat(result.interestPaid()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.principalPaid()).isEqualByComparingTo(new BigDecimal("10000"));
        assertThat(result.newOutstanding()).isEqualByComparingTo(new BigDecimal("490000"));
        verify(expenseRepository, never()).save(any());
        ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
        verify(transferRepository).save(transferCaptor.capture());
        assertThat(transferCaptor.getValue().getAmount()).isEqualByComparingTo(new BigDecimal("10000"));
        assertThat(transferCaptor.getValue().getToAccountId()).isEqualTo(loanId);
    }

    @Test
    void paymentSplitsIntoInterestAndPrincipalWhenAprSet() {
        // 12% APR on 500000 outstanding -> one month's simple interest = 500000*12/1200 = 5000
        WalletAccount loan = loanAccount(new BigDecimal("12"));
        WalletAccount from = spendableFromAccount();
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        when(accountRepository.findByIdAndUserId(fromAccountId, userId)).thenReturn(Optional.of(from));
        when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(new BigDecimal("500000"));

        LoanPaymentService.AccountResult result = service.recordPayment(loanId, userId, new BigDecimal("15000"), fromAccountId);

        assertThat(result.interestPaid()).isEqualByComparingTo(new BigDecimal("5000.00"));
        assertThat(result.principalPaid()).isEqualByComparingTo(new BigDecimal("10000.00"));
        assertThat(result.newOutstanding()).isEqualByComparingTo(new BigDecimal("490000.00"));

        ArgumentCaptor<Expense> expenseCaptor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(expenseCaptor.capture());
        assertThat(expenseCaptor.getValue().getAmount()).isEqualByComparingTo("5000.00");
        assertThat(expenseCaptor.getValue().getCategoryId()).isEqualTo(LoanPaymentService.LOAN_INTEREST_CATEGORY_ID);

        ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
        verify(transferRepository).save(transferCaptor.capture());
        assertThat(transferCaptor.getValue().getAmount()).isEqualByComparingTo("10000.00");
    }

    @Test
    void finalPaymentCapsPrincipalAtOutstandingSoLoanLandsExactlyAtZero() {
        WalletAccount loan = loanAccount(null);
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        // only 3000 left owed, but a 10000 payment is made
        when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(new BigDecimal("3000"));

        LoanPaymentService.AccountResult result = service.recordPayment(loanId, userId, new BigDecimal("10000"), null);

        assertThat(result.principalPaid()).isEqualByComparingTo(new BigDecimal("3000"));
        assertThat(result.newOutstanding()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void processAutopaySkipsAlreadyPaidOffLoan() {
        WalletAccount loan = loanAccount(null);
        lenient().when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(BigDecimal.ZERO);

        boolean paid = service.processAutopay(loan, 202607);

        assertThat(paid).isFalse();
        verify(accountRepository, never()).save(any());
    }

    @Test
    void processAutopayRecordsPaymentAndStampsLastEmiMonth() {
        WalletAccount loan = loanAccount(null);
        loan.setEmiAmount(new BigDecimal("10000"));
        loan.setAutopayAccountId(fromAccountId);
        WalletAccount from = spendableFromAccount();
        when(accountRepository.findByIdAndUserId(loanId, userId)).thenReturn(Optional.of(loan));
        when(accountRepository.findByIdAndUserId(fromAccountId, userId)).thenReturn(Optional.of(from));
        when(walletAccountService.getCurrentBalance(loanId, userId)).thenReturn(new BigDecimal("500000"));

        boolean paid = service.processAutopay(loan, 202607);

        assertThat(paid).isTrue();
        assertThat(loan.getLastEmiYyyymm()).isEqualTo(202607);
        verify(accountRepository).save(loan);
    }
}
