package com.wealthynest.domain.dividend.service;

import com.wealthynest.domain.dividend.dto.request.CreateBondInterestRequest;
import com.wealthynest.domain.dividend.dto.request.CreateDividendRequest;
import com.wealthynest.domain.dividend.dto.response.BondInterestResponse;
import com.wealthynest.domain.dividend.dto.response.DividendResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface DividendService {
    DividendResponse createDividend(UUID userId, CreateDividendRequest request);
    Page<DividendResponse> getDividends(UUID userId, Pageable pageable);
    BondInterestResponse createBondInterest(UUID userId, CreateBondInterestRequest request);
    Page<BondInterestResponse> getBondInterests(UUID userId, Pageable pageable);
}
