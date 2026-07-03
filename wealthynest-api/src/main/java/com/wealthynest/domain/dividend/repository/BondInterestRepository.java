package com.wealthynest.domain.dividend.repository;

import com.wealthynest.domain.dividend.entity.BondInterest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface BondInterestRepository extends JpaRepository<BondInterest, UUID> {
    Page<BondInterest> findByUserIdOrderByInterestDateDesc(UUID userId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(b.amount - b.taxDeducted),0) FROM BondInterest b WHERE b.userId = :userId")
    BigDecimal sumNetInterestByUser(UUID userId);
}
