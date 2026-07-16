package com.wealthynest.domain.dividend.repository;

import com.wealthynest.domain.dividend.entity.DividendIncome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface DividendIncomeRepository extends JpaRepository<DividendIncome, UUID> {
    Page<DividendIncome> findByUserIdOrderByDividendDateDesc(UUID userId, Pageable pageable);
}
