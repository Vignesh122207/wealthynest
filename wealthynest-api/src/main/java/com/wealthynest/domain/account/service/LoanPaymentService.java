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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Records loan payments with the financially-correct EMI split: the interest portion
 * (outstanding × annual rate ÷ 12, simple reducing-balance) is logged as a "Loan Interest"
 * expense so spending reports show the real cost of debt; the principal portion is a
 * transfer into the loan account, which reduces its computed outstanding. When no interest
 * rate is set, the whole payment is treated as principal.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LoanPaymentService {

    /** Fixed id of the "Loan Interest" system category (seeded in V32). */
    public static final UUID LOAN_INTEREST_CATEGORY_ID = UUID.fromString("a0a41e57-0000-0000-0000-000000000001");

    private final WalletAccountRepository   accountRepository;
    private final AccountTransferRepository transferRepository;
    private final ExpenseRepository         expenseRepository;
    private final WalletAccountService      walletAccountService;

    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public AccountResult recordPayment(UUID loanId, UUID userId, BigDecimal amount, UUID fromAccountId) {
        WalletAccount loan = accountRepository.findByIdAndUserId(loanId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", loanId));
        if (loan.getAccountType() != AccountType.LOAN) {
            throw new BusinessException("Payments can only be recorded on loan accounts.", HttpStatus.BAD_REQUEST);
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Payment amount must be positive.", HttpStatus.BAD_REQUEST);
        }
        if (fromAccountId != null) {
            WalletAccount from = accountRepository.findByIdAndUserId(fromAccountId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", fromAccountId));
            if (from.getAccountType().isLiability()) {
                throw new BusinessException("Loan payments cannot be made from another liability account.", HttpStatus.BAD_REQUEST);
            }
        }

        BigDecimal outstanding = currentOutstanding(loan.getId(), userId);
        if (outstanding.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("This loan is already fully paid.", HttpStatus.CONFLICT);
        }

        // Interest split — simple reducing-balance: one month's interest on the current outstanding
        BigDecimal interest = BigDecimal.ZERO;
        if (loan.getApr() != null && loan.getApr().compareTo(BigDecimal.ZERO) > 0) {
            interest = outstanding.multiply(loan.getApr())
                    .divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_UP)
                    .min(amount);
        }
        // Principal never exceeds what's left — the final EMI lands the loan exactly at zero
        BigDecimal principal = amount.subtract(interest).min(outstanding);

        LocalDate today = LocalDate.now();
        String loanLabel = loan.getName() + (loan.getBankName() != null ? " (" + loan.getBankName() + ")" : "");

        if (interest.compareTo(BigDecimal.ZERO) > 0) {
            expenseRepository.save(Expense.builder()
                    .userId(userId)
                    .categoryId(LOAN_INTEREST_CATEGORY_ID)
                    .accountId(fromAccountId)
                    .amount(interest)
                    .expenseDate(today)
                    .description("Loan interest — " + loanLabel)
                    .build());
        }
        if (principal.compareTo(BigDecimal.ZERO) > 0) {
            transferRepository.save(AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(fromAccountId) // null = paid from an untracked source
                    .toAccountId(loan.getId())
                    .amount(principal)
                    .description("Loan payment — " + loanLabel)
                    .transferDate(today)
                    .build());
        }

        log.info("Loan payment on {}: total={}, interest={}, principal={}", loan.getId(), amount, interest, principal);
        return new AccountResult(interest, principal, outstanding.subtract(principal));
    }

    /** Marks the loan as paid this month and pays the configured EMI from the autopay account. */
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public boolean processAutopay(WalletAccount loan, int yyyymm) {
        BigDecimal outstanding = currentOutstanding(loan.getId(), loan.getUserId());
        if (outstanding.compareTo(BigDecimal.ZERO) <= 0) return false;
        recordPayment(loan.getId(), loan.getUserId(), loan.getEmiAmount(), loan.getAutopayAccountId());
        loan.setLastEmiYyyymm(yyyymm);
        accountRepository.save(loan);
        return true;
    }

    private BigDecimal currentOutstanding(UUID loanId, UUID userId) {
        BigDecimal balance = walletAccountService.getCurrentBalance(loanId, userId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    public record AccountResult(BigDecimal interestPaid, BigDecimal principalPaid, BigDecimal newOutstanding) {}
}
