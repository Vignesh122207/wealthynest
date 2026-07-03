package com.wealthynest.domain.recurringincome.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.service.IncomeService;
import com.wealthynest.domain.recurringincome.dto.request.CreateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.response.RecurringIncomeResponse;
import com.wealthynest.domain.recurringincome.entity.RecurringIncome;
import com.wealthynest.domain.recurringincome.repository.RecurringIncomeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
public class RecurringIncomeServiceImpl implements RecurringIncomeService {

    private final RecurringIncomeRepository recurringIncomeRepository;
    private final WalletAccountRepository   walletAccountRepository;
    private final IncomeService             incomeService;

    @Override
    @Transactional(readOnly = true)
    public List<RecurringIncomeResponse> getAll(UUID userId) {
        return recurringIncomeRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public RecurringIncomeResponse create(UUID userId, CreateRecurringIncomeRequest req) {
        RecurringIncome rule = RecurringIncome.builder()
                .userId(userId)
                .accountId(req.getAccountId())
                .source(req.getSource())
                .amount(req.getAmount())
                .description(req.getDescription())
                .dayOfMonth(req.getDayOfMonth())
                .active(true)
                .build();
        return toResponse(recurringIncomeRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringIncomeResponse update(UUID id, UUID userId, UpdateRecurringIncomeRequest req) {
        RecurringIncome rule = findOwned(id, userId);
        if (req.getAccountId()  != null) rule.setAccountId(req.getAccountId());
        if (req.getSource()     != null) rule.setSource(req.getSource());
        if (req.getAmount()     != null) rule.setAmount(req.getAmount());
        if (req.getDescription()!= null) rule.setDescription(req.getDescription());
        if (req.getDayOfMonth() != null) rule.setDayOfMonth(req.getDayOfMonth());
        return toResponse(recurringIncomeRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringIncomeResponse toggleActive(UUID id, UUID userId) {
        RecurringIncome rule = findOwned(id, userId);
        rule.setActive(!rule.isActive());
        return toResponse(recurringIncomeRepository.save(rule));
    }

    @Override
    @Transactional
    public void delete(UUID id, UUID userId) {
        RecurringIncome rule = findOwned(id, userId);
        recurringIncomeRepository.delete(rule);
    }

    @Override
    @Transactional
    public void processScheduled() {
        LocalDate today = LocalDate.now();
        int yyyymm = today.getYear() * 100 + today.getMonthValue();

        List<RecurringIncome> rules = recurringIncomeRepository.findByActiveTrue();
        int credited = 0;
        for (RecurringIncome rule : rules) {
            try {
                if (!isCreditDay(rule.getDayOfMonth(), today)) continue;
                if (rule.getLastCreditedMonth() != null && rule.getLastCreditedMonth() >= yyyymm) continue;

                IncomeSource source;
                try { source = IncomeSource.valueOf(rule.getSource()); }
                catch (IllegalArgumentException e) { source = IncomeSource.OTHER; }

                WalletAccount account = walletAccountRepository.findById(rule.getAccountId()).orElse(null);
                IncomePaymentMode mode = (account != null && "CASH_WALLET".equals(account.getAccountType().name()))
                        ? IncomePaymentMode.CASH : IncomePaymentMode.BANK_ACCOUNT;

                CreateIncomeRequest req = buildIncomeRequest(rule, source, mode, today);
                incomeService.create(rule.getUserId(), req);

                rule.setLastCreditedMonth(yyyymm);
                rule.setLastCreditedAt(LocalDateTime.now());
                recurringIncomeRepository.save(rule);
                credited++;
            } catch (Exception e) {
                log.error("Failed to process recurring income rule {}: {}", rule.getId(), e.getMessage());
            }
        }
        log.info("Recurring income run: {} rule(s) credited on {}", credited, today);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * Returns true when today is the correct credit day for the given rule.
     * dayOfMonth == 0  → last working day (Mon–Fri) of the month.
     * dayOfMonth 1–31 → that fixed calendar day; if the month is shorter
     *                   (e.g. rule=31 but Feb has 28 days) we credit on the last day.
     */
    private boolean isCreditDay(int dayOfMonth, LocalDate today) {
        if (dayOfMonth == 0) {
            // Last working day of this month
            LocalDate lastWorkingDay = lastWorkingDayOf(today.getYear(), today.getMonthValue());
            return today.equals(lastWorkingDay);
        }
        // Fixed day — clamp to the actual last day of month
        int lastDay = YearMonth.of(today.getYear(), today.getMonthValue()).lengthOfMonth();
        int effectiveDay = Math.min(dayOfMonth, lastDay);
        return today.getDayOfMonth() == effectiveDay;
    }

    private LocalDate lastWorkingDayOf(int year, int month) {
        LocalDate last = YearMonth.of(year, month).atEndOfMonth();
        // Walk backwards until we hit Mon–Fri
        while (last.getDayOfWeek() == DayOfWeek.SATURDAY || last.getDayOfWeek() == DayOfWeek.SUNDAY) {
            last = last.minusDays(1);
        }
        return last;
    }

    private RecurringIncome findOwned(UUID id, UUID userId) {
        RecurringIncome rule = recurringIncomeRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringIncome", "id", id));
        if (!rule.getUserId().equals(userId)) throw new AccessDeniedException("Not your rule");
        return rule;
    }

    private CreateIncomeRequest buildIncomeRequest(
            RecurringIncome rule, IncomeSource source, IncomePaymentMode mode, LocalDate date) {
        return new CreateIncomeRequest() {
            public UUID              getAccountId()   { return rule.getAccountId(); }
            public IncomeSource      getSource()      { return source; }
            public IncomePaymentMode getPaymentMode() { return mode; }
            public java.math.BigDecimal getAmount()   { return rule.getAmount(); }
            public String            getDescription() { return rule.getDescription() != null ? rule.getDescription() : "Auto-credit: " + rule.getSource(); }
            public LocalDate         getIncomeDate()  { return date; }
            public Integer           getPeriodMonth() { return date.getMonthValue(); }
            public Integer           getPeriodYear()  { return date.getYear(); }
        };
    }

    private RecurringIncomeResponse toResponse(RecurringIncome r) {
        String accountName = walletAccountRepository.findById(r.getAccountId())
                .map(WalletAccount::getName).orElse("Unknown Account");
        return RecurringIncomeResponse.builder()
                .id(r.getId())
                .accountId(r.getAccountId())
                .accountName(accountName)
                .source(r.getSource())
                .amount(r.getAmount())
                .description(r.getDescription())
                .dayOfMonth(r.getDayOfMonth())
                .active(r.isActive())
                .lastCreditedMonth(r.getLastCreditedMonth())
                .lastCreditedAt(r.getLastCreditedAt())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
