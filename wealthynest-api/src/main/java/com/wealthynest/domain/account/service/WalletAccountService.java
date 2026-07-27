package com.wealthynest.domain.account.service;

import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.domain.account.dto.request.CreateAccountRequest;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.dto.request.UpdateTransferRequest;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.dto.response.TransferResponse;
import org.springframework.data.domain.Pageable;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface WalletAccountService {
    List<AccountResponse>           getAccounts(UUID userId);

    /** Same enrichment as getAccounts, but for several users' accounts in one batched pass —
     * used by family-wide aggregations so it isn't run once per member. */
    List<AccountResponse>           getAccountsForUsers(List<UUID> userIds);
    List<AccountResponse>           getArchivedAccounts(UUID userId);
    AccountResponse                 createAccount(UUID userId, CreateAccountRequest request);
    AccountResponse                 updateAccount(UUID id, UUID userId, CreateAccountRequest request);
    AccountResponse                 archiveAccount(UUID id, UUID userId);
    AccountResponse                 unarchiveAccount(UUID id, UUID userId);
    void                            deleteAccount(UUID id, UUID userId, boolean alsoDeleteTransactions);
    TransferResponse                transfer(UUID userId, TransferRequest request);
    TransferResponse                updateTransfer(UUID transferId, UUID userId, UpdateTransferRequest request);
    void                            deleteTransfer(UUID transferId, UUID userId);
    PagedResponse<TransferResponse> getTransfers(UUID userId, Pageable pageable);
    AccountResponse                 adjustBalance(UUID id, UUID userId, BigDecimal targetBalance);
    AccountResponse                 setPrimary(UUID id, UUID userId);
    void                            checkLowBalance(UUID accountId, UUID userId);

    /** Single-account balance lookup — avoids enriching every account the user owns (as
     * getAccounts() does) when only one account's current balance is actually needed. */
    BigDecimal                      getCurrentBalance(UUID id, UUID userId);
}
