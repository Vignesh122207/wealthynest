package com.wealthynest.domain.dividend.service;

import com.wealthynest.domain.dividend.dto.request.CreateBondInterestRequest;
import com.wealthynest.domain.dividend.dto.request.CreateDividendRequest;
import com.wealthynest.domain.dividend.dto.response.BondInterestResponse;
import com.wealthynest.domain.dividend.dto.response.DividendResponse;
import com.wealthynest.domain.dividend.entity.BondInterest;
import com.wealthynest.domain.dividend.entity.DividendIncome;
import com.wealthynest.domain.dividend.repository.BondInterestRepository;
import com.wealthynest.domain.dividend.repository.DividendIncomeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DividendServiceImpl implements DividendService {
    private final DividendIncomeRepository dividendRepository;
    private final BondInterestRepository   bondRepository;

    @Override @Transactional
    public DividendResponse createDividend(UUID userId, CreateDividendRequest req) {
        BigDecimal tax = req.getTaxDeducted() != null ? req.getTaxDeducted() : BigDecimal.ZERO;
        DividendIncome saved = dividendRepository.save(DividendIncome.builder()
                .userId(userId).investmentId(req.getInvestmentId())
                .amount(req.getAmount()).dividendDate(req.getDividendDate())
                .taxDeducted(tax).notes(req.getNotes()).build());
        return toResponse(saved);
    }

    @Override @Transactional(readOnly = true)
    public Page<DividendResponse> getDividends(UUID userId, Pageable pageable) {
        return dividendRepository.findByUserIdOrderByDividendDateDesc(userId, pageable).map(this::toResponse);
    }

    @Override @Transactional
    public BondInterestResponse createBondInterest(UUID userId, CreateBondInterestRequest req) {
        BigDecimal tax = req.getTaxDeducted() != null ? req.getTaxDeducted() : BigDecimal.ZERO;
        BondInterest saved = bondRepository.save(BondInterest.builder()
                .userId(userId).investmentId(req.getInvestmentId())
                .amount(req.getAmount()).interestDate(req.getInterestDate())
                .taxDeducted(tax).notes(req.getNotes()).build());
        return toBondResponse(saved);
    }

    @Override @Transactional(readOnly = true)
    public Page<BondInterestResponse> getBondInterests(UUID userId, Pageable pageable) {
        return bondRepository.findByUserIdOrderByInterestDateDesc(userId, pageable).map(this::toBondResponse);
    }

    private DividendResponse toResponse(DividendIncome d) {
        return DividendResponse.builder()
                .id(d.getId()).investmentId(d.getInvestmentId())
                .amount(d.getAmount()).taxDeducted(d.getTaxDeducted())
                .netAmount(d.getAmount().subtract(d.getTaxDeducted()))
                .dividendDate(d.getDividendDate()).notes(d.getNotes()).createdAt(d.getCreatedAt()).build();
    }

    private BondInterestResponse toBondResponse(BondInterest b) {
        return BondInterestResponse.builder()
                .id(b.getId()).investmentId(b.getInvestmentId())
                .amount(b.getAmount()).taxDeducted(b.getTaxDeducted())
                .netAmount(b.getAmount().subtract(b.getTaxDeducted()))
                .interestDate(b.getInterestDate()).notes(b.getNotes()).createdAt(b.getCreatedAt()).build();
    }
}
