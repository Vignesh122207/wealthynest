package com.wealthynest.domain.debt.repository;

import com.wealthynest.domain.debt.entity.DebtPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface DebtPaymentRepository extends JpaRepository<DebtPayment, UUID> {
    List<DebtPayment> findByDebtIdOrderByPaidAtDesc(UUID debtId);
}
