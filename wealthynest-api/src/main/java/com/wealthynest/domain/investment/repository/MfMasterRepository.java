package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.MfMaster;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MfMasterRepository extends JpaRepository<MfMaster, String> {

    /**
     * Case-insensitive substring search on scheme name, ranked exact/starts-with first. Backed by
     * a pg_trgm GIN index (idx_mf_master_name_trgm) since this table is ~20x the row count of
     * stock_master, where a plain LIKE '%q%' scan is fine without one.
     */
    @Query("""
        SELECT m FROM MfMaster m
        WHERE LOWER(m.schemeName) LIKE LOWER(CONCAT('%', :q, '%'))
        ORDER BY
          CASE WHEN LOWER(m.schemeName) LIKE LOWER(CONCAT(:q, '%')) THEN 0 ELSE 1 END,
          LENGTH(m.schemeName),
          m.schemeName
        """)
    List<MfMaster> search(@Param("q") String q, Pageable pageable);

    @Modifying
    @Query(value = "TRUNCATE TABLE mf_master", nativeQuery = true)
    void truncate();
}
