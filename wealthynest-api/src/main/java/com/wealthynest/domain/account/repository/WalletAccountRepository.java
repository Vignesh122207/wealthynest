package com.wealthynest.domain.account.repository;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletAccountRepository extends JpaRepository<WalletAccount, UUID> {
    List<WalletAccount> findByUserIdOrderByCreatedAtAsc(UUID userId);
    List<WalletAccount> findByUserIdAndArchivedTrueOrderByCreatedAtAsc(UUID userId);
    Optional<WalletAccount> findByUserIdAndAccountType(UUID userId, AccountType accountType);
    boolean existsByUserIdAndAccountType(UUID userId, AccountType accountType);
    boolean existsByUserIdAndAccountTypeAndArchivedFalse(UUID userId, AccountType accountType);
}
