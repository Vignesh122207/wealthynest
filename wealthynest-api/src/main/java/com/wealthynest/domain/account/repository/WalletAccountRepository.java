package com.wealthynest.domain.account.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletAccountRepository extends JpaRepository<WalletAccount, UUID> {
    List<WalletAccount> findByUserIdOrderByCreatedAtAsc(UUID userId);
    List<WalletAccount> findByUserIdAndArchivedTrueOrderByCreatedAtAsc(UUID userId);
    boolean existsByUserIdAndAccountType(UUID userId, AccountType accountType);
    boolean existsByUserIdAndAccountTypeAndArchivedFalse(UUID userId, AccountType accountType);
    Optional<WalletAccount> findByIdAndUserId(UUID id, UUID userId);
    List<WalletAccount> findByAccountTypeAndArchivedFalse(AccountType accountType);

    /** Candidates for the daily low-balance sweep — accounts with an alert threshold configured. */
    List<WalletAccount> findByArchivedFalseAndLowBalanceThresholdIsNotNull();

    @Modifying
    @Query("UPDATE WalletAccount a SET a.primary = false " +
           "WHERE a.userId = :userId AND a.accountType = :accountType AND a.primary = true")
    void clearPrimaryForType(UUID userId, AccountType accountType);
}
