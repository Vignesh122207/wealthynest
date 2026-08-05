package com.wealthynest.infra.scheduler;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.WalletAccountService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class LowBalanceScheduler {

    private final WalletAccountRepository accountRepository;
    private final WalletAccountService    walletAccountService;

    /**
     * Catches accounts that drifted below their threshold without a triggering expense/transfer
     * in this app (e.g. external interest/fee changes never entered here) — the same-day dedup on
     * the notification itself means this is a no-op for accounts already alerted today.
     * Not read-only: checkLowBalance() writes a notification when it fires, and readOnly=true
     * would put Hibernate in manual-flush mode, silently dropping that write on commit.
     */
    @Transactional
    public void checkAllAccounts() {
        int checked = 0;
        for (WalletAccount account : accountRepository.findByStatusAndLowBalanceThresholdIsNotNull(LifecycleStatus.ACTIVE)) {
            try {
                walletAccountService.checkLowBalance(account.getId(), account.getUserId());
                checked++;
            } catch (Exception e) {
                log.warn("Low balance sweep failed for account={}: {}", account.getId(), e.getMessage());
            }
        }
        log.info("Low balance sweep complete: {} account(s) checked", checked);
    }
}
