package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.StockPriceCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StockPriceCacheRepository extends JpaRepository<StockPriceCache, String> {}
