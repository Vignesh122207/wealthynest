package com.wealthynest.domain.liability.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.mapper.LiabilityMapper;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LiabilityServiceImpl implements LiabilityService {

    private final LiabilityRepository  liabilityRepository;
    private final LiabilityMapper      liabilityMapper;
    private final WalletAccountService walletAccountService;

    private void validateOutstanding(CreateLiabilityRequest req) {
        if (req.getOutstandingAmount() != null && req.getPrincipalAmount() != null &&
            req.getOutstandingAmount().compareTo(req.getPrincipalAmount()) > 0) {
            throw new BusinessException(
                "Outstanding balance cannot exceed the original loan amount",
                HttpStatus.BAD_REQUEST, "OUTSTANDING_EXCEEDS_PRINCIPAL");
        }
    }

    @Override @Transactional
    public LiabilityResponse createLiability(UUID userId, UUID familyId, CreateLiabilityRequest req) {
        validateOutstanding(req);
        Liability liability = liabilityMapper.toEntity(req);
        liability.setUserId(userId);
        liability.setFamilyId(familyId);
        return liabilityMapper.toResponse(liabilityRepository.save(liability));
    }

    @Override @Transactional
    public LiabilityResponse updateLiability(UUID id, UUID userId, CreateLiabilityRequest req) {
        validateOutstanding(req);
        Liability liability = findAndValidate(id, userId);
        liability.setName(req.getName());
        liability.setLiabilityType(req.getLiabilityType());
        liability.setPrincipalAmount(req.getPrincipalAmount());
        liability.setOutstandingAmount(req.getOutstandingAmount());
        if (req.getInterestRate()  != null) liability.setInterestRate(req.getInterestRate());
        if (req.getLenderName()    != null) liability.setLenderName(req.getLenderName());
        if (req.getEmiAmount()     != null) liability.setEmiAmount(req.getEmiAmount());
        if (req.getStartDate()     != null) liability.setStartDate(req.getStartDate());
        if (req.getEndDate()       != null) liability.setEndDate(req.getEndDate());
        if (req.getNotes()         != null) liability.setNotes(req.getNotes());
        return liabilityMapper.toResponse(liabilityRepository.save(liability));
    }

    @Override @Transactional
    public void deleteLiability(UUID id, UUID userId) {
        Liability liability = findAndValidate(id, userId);
        liability.setActive(false);
        liabilityRepository.save(liability);
    }

    @Override @Transactional(readOnly = true)
    public List<LiabilityResponse> getLiabilities(UUID userId, UUID familyId) {
        List<LiabilityResponse> result = new ArrayList<>(liabilityMapper.toResponseList(
                liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)));

        // Derived entries computed live from Accounts (single source of truth — no shadow rows):
        // loan-account outstandings and credit-card dues, shown read-only in the Liabilities tab.
        for (AccountResponse a : walletAccountService.getAccounts(userId)) {
            BigDecimal bal = a.getCurrentBalance() != null ? a.getCurrentBalance() : BigDecimal.ZERO;
            if ("LOAN".equals(a.getAccountType())) {
                result.add(LiabilityResponse.builder()
                        .id(a.getId())
                        .name(a.getName())
                        .liabilityType(a.getLoanType() != null ? a.getLoanType() : "OTHER")
                        .principalAmount(a.getPrincipalAmount())
                        .outstandingAmount(bal.max(BigDecimal.ZERO))
                        .interestRate(a.getApr())
                        .lenderName(a.getBankName())
                        .emiAmount(a.getEmiAmount())
                        .endDate(a.getLoanEndDate())
                        .active(true)
                        .derived(true)
                        .sourceAccountId(a.getId())
                        .createdAt(a.getCreatedAt())
                        .build());
            } else if ("CREDIT_CARD".equals(a.getAccountType()) && bal.compareTo(BigDecimal.ZERO) > 0) {
                result.add(LiabilityResponse.builder()
                        .id(a.getId())
                        .name(a.getName())
                        .liabilityType("CREDIT_CARD")
                        .principalAmount(a.getCreditLimit())
                        .outstandingAmount(bal)
                        .interestRate(a.getApr())
                        .lenderName(a.getBankName())
                        .endDate(a.getNextDueDate())
                        .active(true)
                        .derived(true)
                        .sourceAccountId(a.getId())
                        .createdAt(a.getCreatedAt())
                        .build());
            }
        }
        return result;
    }

    @Override @Transactional(readOnly = true)
    public BigDecimal getTotalOutstanding(UUID userId, UUID familyId) {
        return liabilityRepository.sumOutstandingByUser(userId);
    }

    private Liability findAndValidate(UUID id, UUID userId) {
        Liability l = liabilityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Liability", "id", id));
        if (!l.getUserId().equals(userId)) throw new AccessDeniedException();
        return l;
    }
}
