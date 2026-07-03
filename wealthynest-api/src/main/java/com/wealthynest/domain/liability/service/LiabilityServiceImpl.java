package com.wealthynest.domain.liability.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import org.springframework.http.HttpStatus;
import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.mapper.LiabilityMapper;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LiabilityServiceImpl implements LiabilityService {

    private final LiabilityRepository liabilityRepository;
    private final LiabilityMapper     liabilityMapper;

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
        return liabilityMapper.toResponseList(
                liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId));
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
