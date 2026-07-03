package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.GoldPriceCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GoldPriceCacheRepository extends JpaRepository<GoldPriceCache, Integer> {}
