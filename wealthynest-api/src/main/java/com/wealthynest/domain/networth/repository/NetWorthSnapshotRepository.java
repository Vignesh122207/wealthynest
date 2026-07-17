package com.wealthynest.domain.networth.repository;

import com.wealthynest.domain.networth.entity.NetWorthSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NetWorthSnapshotRepository extends JpaRepository<NetWorthSnapshot, UUID> {

    Optional<NetWorthSnapshot> findByUserIdAndYearAndMonth(UUID userId, int year, int month);

    @Query("""
        SELECT s FROM NetWorthSnapshot s
        WHERE s.userId = :userId
        ORDER BY s.year DESC, s.month DESC
        LIMIT 13
        """)
    List<NetWorthSnapshot> findLast13ByUserId(@Param("userId") UUID userId);
}
