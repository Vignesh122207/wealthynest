package com.wealthynest.domain.dividend.repository;

import com.wealthynest.domain.dividend.entity.DividendIncome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface DividendIncomeRepository extends JpaRepository<DividendIncome, UUID> {
    Page<DividendIncome> findByUserIdOrderByDividendDateDesc(UUID userId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(d.amount - d.taxDeducted),0) FROM DividendIncome d WHERE d.userId = :userId")
    BigDecimal sumNetDividendByUser(UUID userId);

    @Query("SELECT COALESCE(SUM(d.amount - d.taxDeducted),0) FROM DividendIncome d WHERE d.userId = :userId AND YEAR(d.dividendDate) = :year")
    BigDecimal sumNetDividendByUserAndYear(UUID userId, int year);
}
