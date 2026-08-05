package com.wealthynest.domain.account.repository;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletAccountRepository extends JpaRepository<WalletAccount, UUID> {
    List<WalletAccount> findByUserIdOrderByCreatedAtAsc(UUID userId);
    List<WalletAccount> findByUserIdAndStatusOrderByCreatedAtAsc(UUID userId, LifecycleStatus status);
    /** ACTIVE + CLOSED accounts for a set of users — excludes only ARCHIVED (user-hidden). */
    List<WalletAccount> findByUserIdInAndStatusNot(List<UUID> userIds, LifecycleStatus status);
    boolean existsByUserIdAndAccountTypeAndStatus(UUID userId, AccountType accountType, LifecycleStatus status);
    Optional<WalletAccount> findByIdAndUserId(UUID id, UUID userId);
    List<WalletAccount> findByAccountTypeAndStatus(AccountType accountType, LifecycleStatus status);

    /**
     * Same lookup as findByIdAndUserId but takes a row-level lock (SELECT ... FOR UPDATE) held for
     * the rest of the caller's transaction — used by AccountBalanceGuard so two concurrent writes
     * against the same account serialize instead of both reading the pre-write balance and both
     * passing validation (the account-overdraft/credit-limit race).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM WalletAccount a WHERE a.id = :id AND a.userId = :userId")
    Optional<WalletAccount> findByIdAndUserIdForUpdate(UUID id, UUID userId);

    /** Candidates for the daily low-balance sweep — accounts with an alert threshold configured. */
    List<WalletAccount> findByStatusAndLowBalanceThresholdIsNotNull(LifecycleStatus status);

    @Modifying
    @Query("UPDATE WalletAccount a SET a.primary = false " +
           "WHERE a.userId = :userId AND a.accountType = :accountType AND a.primary = true")
    void clearPrimaryForType(UUID userId, AccountType accountType);
}
