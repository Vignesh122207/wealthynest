package com.wealthynest.domain.income.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.dto.request.UpdateIncomeRequest;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IncomeServiceImpl implements IncomeService {
    private final IncomeRepository incomeRepository;
    private final AccountOwnershipGuard accountOwnershipGuard;
    private final InvestmentIncomeLogRepository investmentIncomeLogRepository;

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public IncomeResponse create(UUID userId, CreateIncomeRequest request) {
        accountOwnershipGuard.validateAccountOwnership(request.getAccountId(), userId);
        com.wealthynest.domain.income.entity.IncomePaymentMode mode =
                request.getPaymentMode() != null
                        ? request.getPaymentMode()
                        : com.wealthynest.domain.income.entity.IncomePaymentMode.BANK_ACCOUNT;
        IncomeEntry entry = IncomeEntry.builder()
                .userId(userId)
                .accountId(request.getAccountId())
                .source(request.getSource())
                .paymentMode(mode)
                .amount(request.getAmount())
                .description(request.getDescription())
                .incomeDate(request.getIncomeDate())
                .periodMonth(request.getPeriodMonth())
                .periodYear(request.getPeriodYear())
                .build();
        return toResponse(incomeRepository.save(entry));
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncomeResponse> getAll(UUID userId) {
        return incomeRepository.findByUserIdAndDebtFalseOrderByIncomeDateDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncomeResponse> getAll(UUID userId, boolean includeDebt) {
        if (!includeDebt) return getAll(userId);
        return incomeRepository.findByUserIdOrderByIncomeDateDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncomeResponse> getByYear(UUID userId, int year) {
        return incomeRepository.findByUserAndYear(userId, year)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncomeResponse> getByPeriod(UUID userId, int year, int month) {
        return incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(userId, year, month)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<IncomeResponse> getByPeriod(UUID userId, int year, int month, boolean includeDebt) {
        if (!includeDebt) return getByPeriod(userId, year, month);
        return incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthOrderByIncomeDateDesc(userId, year, month)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public IncomeResponse update(UUID id, UUID userId, UpdateIncomeRequest request) {
        IncomeEntry entry = findAndValidateOwner(id, userId);
        if (request.getAmount()      != null) entry.setAmount(request.getAmount());
        if (request.getSource()      != null) entry.setSource(request.getSource());
        if (request.getDescription() != null) entry.setDescription(request.getDescription());
        if (request.getIncomeDate()  != null) entry.setIncomeDate(request.getIncomeDate());
        if (request.getPeriodMonth() != null) entry.setPeriodMonth(request.getPeriodMonth());
        if (request.getPeriodYear()  != null) entry.setPeriodYear(request.getPeriodYear());
        if (request.getAccountId()   != null) {
            accountOwnershipGuard.validateAccountOwnership(request.getAccountId(), userId);
            entry.setAccountId(request.getAccountId());
        }
        if (request.getPaymentMode() != null) entry.setPaymentMode(request.getPaymentMode());
        return toResponse(incomeRepository.save(entry));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public void delete(UUID id, UUID userId) {
        IncomeEntry entry = findAndValidateOwner(id, userId);
        // income_entry_id has no ON DELETE policy — clear the back-reference from any auto-logged
        // investment income (dividend/interest/FD maturity) before deleting the row it points to.
        investmentIncomeLogRepository.clearIncomeEntryId(id);
        incomeRepository.delete(entry);
    }

    private IncomeEntry findAndValidateOwner(UUID id, UUID userId) {
        IncomeEntry entry = incomeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("IncomeEntry", "id", id));
        if (!entry.getUserId().equals(userId)) throw new AccessDeniedException();
        return entry;
    }

    private IncomeResponse toResponse(IncomeEntry e) {
        return IncomeResponse.builder()
                .id(e.getId()).accountId(e.getAccountId()).source(e.getSource().name())
                .paymentMode(e.getPaymentMode() != null ? e.getPaymentMode().name() : "BANK_ACCOUNT")
                .amount(e.getAmount()).description(e.getDescription())
                .incomeDate(e.getIncomeDate())
                .periodMonth(e.getPeriodMonth()).periodYear(e.getPeriodYear())
                .debt(e.isDebt())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
