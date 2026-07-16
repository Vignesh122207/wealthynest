package com.wealthynest.domain.account.repository;

import com.wealthynest.domain.account.entity.AccountTransfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface AccountTransferRepository extends JpaRepository<AccountTransfer, UUID> {

    Page<AccountTransfer> findByUserIdOrderByTransferDateDesc(UUID userId, Pageable pageable);

    /** Legacy — only used for cascade-delete when an account is removed. */
    @Query("SELECT t FROM AccountTransfer t WHERE t.fromAccountId = :id OR t.toAccountId = :id ORDER BY t.transferDate DESC")
    List<AccountTransfer> findByAccountId(UUID id);

    /** Efficient limited query for the recent-transactions sidebar (avoids loading all records). */
    @Query("SELECT t FROM AccountTransfer t WHERE (t.fromAccountId = :id OR t.toAccountId = :id) ORDER BY t.transferDate DESC LIMIT 5")
    List<AccountTransfer> findTop5ByAccountId(UUID id);

    @Query("SELECT COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.toAccountId = :accountId")
    BigDecimal sumTransfersIn(UUID accountId);

    @Query("SELECT COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.fromAccountId = :accountId")
    BigDecimal sumTransfersOut(UUID accountId);

    @Query("SELECT COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.toAccountId = :accountId AND t.description != 'Balance Adjustment' AND t.debt = false")
    BigDecimal sumRegularTransfersIn(UUID accountId);

    @Query("SELECT COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.fromAccountId = :accountId AND t.description != 'Balance Adjustment' AND t.debt = false")
    BigDecimal sumRegularTransfersOut(UUID accountId);

    /** Batched equivalents for list views — one grouped query instead of N per account. */
    @Query("SELECT t.toAccountId, COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.toAccountId IN :accountIds GROUP BY t.toAccountId")
    List<Object[]> sumTransfersInGrouped(@Param("accountIds") Collection<UUID> accountIds);

    @Query("SELECT t.fromAccountId, COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.fromAccountId IN :accountIds GROUP BY t.fromAccountId")
    List<Object[]> sumTransfersOutGrouped(@Param("accountIds") Collection<UUID> accountIds);

    @Query("SELECT t.toAccountId, COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.toAccountId IN :accountIds AND t.description != 'Balance Adjustment' AND t.debt = false GROUP BY t.toAccountId")
    List<Object[]> sumRegularTransfersInGrouped(@Param("accountIds") Collection<UUID> accountIds);

    @Query("SELECT t.fromAccountId, COALESCE(SUM(t.amount),0) FROM AccountTransfer t WHERE t.fromAccountId IN :accountIds AND t.description != 'Balance Adjustment' AND t.debt = false GROUP BY t.fromAccountId")
    List<Object[]> sumRegularTransfersOutGrouped(@Param("accountIds") Collection<UUID> accountIds);
}
