package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.UUID;

/**
 * Shared IDOR guard for services that accept a wallet-account id as a foreign reference
 * (expense/income/debt/goal/investment/recurring-income) — confirms the account belongs
 * to the caller before it's used, without leaking whether a different user's account exists.
 */
@Component
@RequiredArgsConstructor
public class AccountOwnershipGuard {
    private final WalletAccountRepository accountRepository;

    public void validateAccountOwnership(UUID accountId, UUID userId) {
        if (accountId == null) return;
        accountRepository.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("WalletAccount", "id", accountId));
    }
}
