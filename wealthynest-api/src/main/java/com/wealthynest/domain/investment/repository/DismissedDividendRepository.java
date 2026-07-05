package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.DismissedDividend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface DismissedDividendRepository extends JpaRepository<DismissedDividend, UUID> {
    boolean existsByUserIdAndInvestmentIdAndExDate(UUID userId, UUID investmentId, LocalDate exDate);
    List<DismissedDividend> findByUserId(UUID userId);
    void deleteByUserIdAndInvestmentIdAndExDate(UUID userId, UUID investmentId, LocalDate exDate);
}
