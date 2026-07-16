package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.repository.IncomeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Blocks a spend (expense, or the "from" side of a transfer/debt repayment) from driving a
 * spendable-balance account negative, and from pushing a credit card past its limit. Loans and
 * other liability accounts aren't "spendable" — their balance is what's owed, so it's expected
 * (not an error) for it to grow when money is spent on them.
 */
@Component
@RequiredArgsConstructor
public class AccountBalanceGuard {
    private final WalletAccountRepository   accountRepository;
    private final IncomeRepository          incomeRepository;
    private final ExpenseRepository         expenseRepository;
    private final AccountTransferRepository transferRepository;

    /**
     * @param amount         the spend being validated (new expense amount, transfer amount, etc.)
     * @param previousAmount the amount this same record already contributed before the edit — pass
     *                       BigDecimal.ZERO for a brand-new expense/transfer, or the prior amount
     *                       when editing one, so the edit doesn't double-count itself against the
     *                       account's current (already-including-the-old-amount) balance.
     */
    public void validateSufficientBalance(UUID accountId, UUID userId, BigDecimal amount, BigDecimal previousAmount) {
        if (accountId == null || amount == null) return;
        WalletAccount account = accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", accountId));
        BigDecimal already = previousAmount != null ? previousAmount : BigDecimal.ZERO;
        BigDecimal balance = currentBalance(account);

        if (account.getAccountType() == AccountType.CREDIT_CARD) {
            BigDecimal limit = account.getCreditLimit();
            if (limit == null) return; // no limit configured — nothing to enforce
            BigDecimal outstandingAfter = balance.subtract(already).add(amount);
            if (outstandingAfter.compareTo(limit) > 0) {
                throw new BusinessException(
                        "This would exceed " + account.getName() + "'s credit limit.", HttpStatus.BAD_REQUEST);
            }
            return;
        }

        if (account.getAccountType().isLiability()) return; // LOAN — balance is a debt, not spendable funds

        BigDecimal balanceAfter = balance.add(already).subtract(amount);
        if (balanceAfter.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(
                    "Insufficient balance in " + account.getName() + ".", HttpStatus.BAD_REQUEST);
        }
    }

    /** Same formula as WalletAccountServiceImpl's enrich() — kept separate since that method also
     * computes display-only totals this check doesn't need. */
    private BigDecimal currentBalance(WalletAccount account) {
        UUID id = account.getId();
        BigDecimal incomeIn     = incomeRepository.sumByAccountId(id);
        BigDecimal expenseOut   = expenseRepository.sumByAccountId(id);
        BigDecimal transfersIn  = transferRepository.sumTransfersIn(id);
        BigDecimal transfersOut = transferRepository.sumTransfersOut(id);
        return account.getAccountType().isLiability()
                ? account.getOpeningBalance().add(expenseOut).add(transfersOut).subtract(incomeIn).subtract(transfersIn)
                : account.getOpeningBalance().add(incomeIn).add(transfersIn).subtract(expenseOut).subtract(transfersOut);
    }
}
