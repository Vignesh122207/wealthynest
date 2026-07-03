package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.MFNavCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MFNavCacheRepository extends JpaRepository<MFNavCache, String> {}
