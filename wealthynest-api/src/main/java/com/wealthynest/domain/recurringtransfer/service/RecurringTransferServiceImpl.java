package com.wealthynest.domain.recurringtransfer.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.recurringtransfer.dto.request.CreateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.response.RecurringTransferResponse;
import com.wealthynest.domain.recurringtransfer.entity.RecurringTransfer;
import com.wealthynest.domain.recurringtransfer.repository.RecurringTransferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecurringTransferServiceImpl implements RecurringTransferService {

    private final RecurringTransferRepository recurringTransferRepository;
    private final WalletAccountRepository     walletAccountRepository;
    private final AccountOwnershipGuard       accountOwnershipGuard;
    private final WalletAccountService        walletAccountService;

    @Override
    @Transactional(readOnly = true)
    public List<RecurringTransferResponse> getAll(UUID userId) {
        return recurringTransferRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public RecurringTransferResponse create(UUID userId, CreateRecurringTransferRequest req) {
        validateAccounts(req.getFromAccountId(), req.getToAccountId(), userId);
        RecurringTransfer rule = RecurringTransfer.builder()
                .userId(userId)
                .fromAccountId(req.getFromAccountId())
                .toAccountId(req.getToAccountId())
                .amount(req.getAmount())
                .description(req.getDescription())
                .dayOfMonth(req.getDayOfMonth())
                .active(true)
                .build();
        return toResponse(recurringTransferRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringTransferResponse update(UUID id, UUID userId, UpdateRecurringTransferRequest req) {
        RecurringTransfer rule = findOwned(id, userId);
        UUID nextFrom = req.getFromAccountId() != null ? req.getFromAccountId() : rule.getFromAccountId();
        UUID nextTo   = req.getToAccountId()   != null ? req.getToAccountId()   : rule.getToAccountId();
        if (req.getFromAccountId() != null || req.getToAccountId() != null) {
            validateAccounts(nextFrom, nextTo, userId);
            rule.setFromAccountId(nextFrom);
            rule.setToAccountId(nextTo);
        }
        if (req.getAmount()      != null) rule.setAmount(req.getAmount());
        if (req.getDescription() != null) rule.setDescription(req.getDescription());
        if (req.getDayOfMonth()  != null) rule.setDayOfMonth(req.getDayOfMonth());
        return toResponse(recurringTransferRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringTransferResponse toggleActive(UUID id, UUID userId) {
        RecurringTransfer rule = findOwned(id, userId);
        rule.setActive(!rule.isActive());
        return toResponse(recurringTransferRepository.save(rule));
    }

    @Override
    @Transactional
    public void delete(UUID id, UUID userId) {
        RecurringTransfer rule = findOwned(id, userId);
        recurringTransferRepository.delete(rule);
    }

    @Override
    @Transactional
    public void processScheduled() {
        LocalDate today = LocalDate.now();
        int yyyymm = today.getYear() * 100 + today.getMonthValue();

        List<RecurringTransfer> rules = recurringTransferRepository.findByActiveTrue();
        int transferred = 0;
        for (RecurringTransfer rule : rules) {
            try {
                if (!isTransferDay(rule.getDayOfMonth(), today)) continue;
                if (rule.getLastTransferredMonth() != null && rule.getLastTransferredMonth() >= yyyymm) continue;

                TransferRequest req = buildTransferRequest(rule, today);
                walletAccountService.transfer(rule.getUserId(), req);

                rule.setLastTransferredMonth(yyyymm);
                rule.setLastTransferredAt(LocalDateTime.now());
                recurringTransferRepository.save(rule);
                transferred++;
            } catch (Exception e) {
                log.error("Failed to process recurring transfer rule {}: {}", rule.getId(), e.getMessage(), e);
            }
        }
        log.info("Recurring transfer run: {} rule(s) transferred on {}", transferred, today);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private void validateAccounts(UUID fromAccountId, UUID toAccountId, UUID userId) {
        if (fromAccountId.equals(toAccountId)) {
            throw new BusinessException("From and To accounts must be different", HttpStatus.BAD_REQUEST);
        }
        accountOwnershipGuard.validateAccountOwnership(fromAccountId, userId);
        accountOwnershipGuard.validateAccountOwnership(toAccountId, userId);
    }

    /**
     * Same day-of-month semantics as RecurringIncome: dayOfMonth == 0 means the last working
     * day (Mon–Fri) of the month; 1–31 clamps to the month's actual last day.
     */
    private boolean isTransferDay(int dayOfMonth, LocalDate today) {
        if (dayOfMonth == 0) {
            return today.equals(lastWorkingDayOf(today.getYear(), today.getMonthValue()));
        }
        int lastDay = YearMonth.of(today.getYear(), today.getMonthValue()).lengthOfMonth();
        int effectiveDay = Math.min(dayOfMonth, lastDay);
        return today.getDayOfMonth() == effectiveDay;
    }

    private LocalDate lastWorkingDayOf(int year, int month) {
        LocalDate last = YearMonth.of(year, month).atEndOfMonth();
        while (last.getDayOfWeek() == DayOfWeek.SATURDAY || last.getDayOfWeek() == DayOfWeek.SUNDAY) {
            last = last.minusDays(1);
        }
        return last;
    }

    private RecurringTransfer findOwned(UUID id, UUID userId) {
        RecurringTransfer rule = recurringTransferRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringTransfer", "id", id));
        if (!rule.getUserId().equals(userId)) throw new AccessDeniedException("Not your rule");
        return rule;
    }

    private TransferRequest buildTransferRequest(RecurringTransfer rule, LocalDate date) {
        return new TransferRequest() {
            public UUID       getFromAccountId() { return rule.getFromAccountId(); }
            public UUID       getToAccountId()   { return rule.getToAccountId(); }
            public java.math.BigDecimal getAmount() { return rule.getAmount(); }
            public String     getDescription()   { return rule.getDescription() != null ? rule.getDescription() : "Auto-transfer"; }
            public LocalDate  getTransferDate()  { return date; }
        };
    }

    private RecurringTransferResponse toResponse(RecurringTransfer r) {
        String fromName = walletAccountRepository.findById(r.getFromAccountId())
                .map(WalletAccount::getName).orElse("Unknown Account");
        String toName = walletAccountRepository.findById(r.getToAccountId())
                .map(WalletAccount::getName).orElse("Unknown Account");
        return RecurringTransferResponse.builder()
                .id(r.getId())
                .fromAccountId(r.getFromAccountId())
                .fromAccountName(fromName)
                .toAccountId(r.getToAccountId())
                .toAccountName(toName)
                .amount(r.getAmount())
                .description(r.getDescription())
                .dayOfMonth(r.getDayOfMonth())
                .active(r.isActive())
                .lastTransferredMonth(r.getLastTransferredMonth())
                .lastTransferredAt(r.getLastTransferredAt())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
