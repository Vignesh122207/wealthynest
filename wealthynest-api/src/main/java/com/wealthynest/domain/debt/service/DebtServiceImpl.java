package com.wealthynest.domain.debt.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.debt.dto.request.CreateDebtRequest;
import com.wealthynest.domain.debt.dto.request.RecordPaymentRequest;
import com.wealthynest.domain.debt.dto.request.UpdateDebtRequest;
import com.wealthynest.domain.debt.dto.response.DebtPaymentResponse;
import com.wealthynest.domain.debt.dto.response.DebtRecordResponse;
import com.wealthynest.domain.debt.entity.DebtPayment;
import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtStatus;
import com.wealthynest.domain.debt.entity.DebtType;
import com.wealthynest.domain.debt.repository.DebtPaymentRepository;
import com.wealthynest.domain.debt.repository.DebtRecordRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.repository.IncomeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DebtServiceImpl implements DebtService {

    private final DebtRecordRepository   debtRecordRepository;
    private final DebtPaymentRepository  debtPaymentRepository;
    private final WalletAccountRepository accountRepository;
    private final ExpenseRepository      expenseRepository;
    private final IncomeRepository       incomeRepository;

    // System "Debt & Loans" expense category (inserted by migration)
    private static final UUID DEBT_LOANS_CATEGORY_ID = UUID.fromString("d1eb7000-0000-0000-0000-000000000001");

    @Override
    @Transactional(readOnly = true)
    public List<DebtRecordResponse> getAll(UUID userId) {
        return debtRecordRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DebtRecordResponse> getByType(UUID userId, DebtType type) {
        return debtRecordRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, type)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public DebtRecordResponse create(UUID userId, CreateDebtRequest request) {
        DebtRecord record = DebtRecord.builder()
                .userId(userId)
                .type(request.getType())
                .accountId(request.getAccountId())
                .contactName(request.getContactName())
                .contactPhone(request.getContactPhone())
                .amount(request.getAmount())
                .description(request.getDescription())
                .dueDate(request.getDueDate())
                .build();
        record = debtRecordRepository.save(record);

        // Create an explicit account transaction when a linked account is specified
        if (request.getAccountId() != null) {
            LocalDate today = LocalDate.now();
            String label = request.getDescription() != null && !request.getDescription().isBlank()
                ? request.getDescription()
                : (request.getType() == DebtType.LENT
                    ? "Lent to " + request.getContactName()
                    : "Borrowed from " + request.getContactName());

            if (request.getType() == DebtType.LENT) {
                // Debit the account — money went out
                Expense expense = Expense.builder()
                        .userId(userId)
                        .categoryId(DEBT_LOANS_CATEGORY_ID)
                        .accountId(request.getAccountId())
                        .amount(request.getAmount())
                        .expenseDate(today)
                        .description(label)
                        .debt(true)
                        .build();
                Expense saved = expenseRepository.save(expense);
                record.setLinkedExpenseId(saved.getId());
            } else {
                // Credit the account — money came in
                IncomeEntry income = IncomeEntry.builder()
                        .userId(userId)
                        .accountId(request.getAccountId())
                        .source(IncomeSource.OTHER)
                        .paymentMode(IncomePaymentMode.BANK_ACCOUNT)
                        .amount(request.getAmount())
                        .incomeDate(today)
                        .periodMonth(today.getMonthValue())
                        .periodYear(today.getYear())
                        .description(label)
                        .debt(true)
                        .build();
                IncomeEntry saved = incomeRepository.save(income);
                record.setLinkedIncomeId(saved.getId());
            }
            record = debtRecordRepository.save(record);
        }

        return toResponse(record);
    }

    @Override
    @Transactional
    public DebtRecordResponse update(UUID id, UUID userId, UpdateDebtRequest request) {
        DebtRecord record = findOwned(id, userId);
        if (request.getContactName()  != null) record.setContactName(request.getContactName());
        if (request.getContactPhone() != null) record.setContactPhone(request.getContactPhone());
        if (request.getDescription()  != null) record.setDescription(request.getDescription());
        if (request.getDueDate()      != null) record.setDueDate(request.getDueDate());

        if (request.getAmount() != null && request.getAmount().compareTo(record.getAmount()) != 0) {
            record.setAmount(request.getAmount());
            // Keep the linked account entry in sync
            if (record.getLinkedExpenseId() != null) {
                expenseRepository.findById(record.getLinkedExpenseId()).ifPresent(e -> {
                    e.setAmount(request.getAmount());
                    expenseRepository.save(e);
                });
            }
            if (record.getLinkedIncomeId() != null) {
                incomeRepository.findById(record.getLinkedIncomeId()).ifPresent(inc -> {
                    inc.setAmount(request.getAmount());
                    incomeRepository.save(inc);
                });
            }
        }

        return toResponse(debtRecordRepository.save(record));
    }

    @Override
    @Transactional
    public DebtRecordResponse recordPayment(UUID id, UUID userId, RecordPaymentRequest request) {
        DebtRecord record = findOwned(id, userId);
        if (record.getStatus() == DebtStatus.SETTLED)
            throw new IllegalStateException("Debt is already fully settled");

        // Create an account entry to reflect the money movement
        UUID linkedEntryId = null;
        if (record.getAccountId() != null) {
            LocalDate today = LocalDate.now();
            String label = (request.getNote() != null && !request.getNote().isBlank())
                    ? request.getNote()
                    : (record.getType() == DebtType.LENT
                            ? "Received from " + record.getContactName()
                            : "Paid to " + record.getContactName());

            if (record.getType() == DebtType.LENT) {
                // Money came back in — credit the account
                IncomeEntry income = IncomeEntry.builder()
                        .userId(record.getUserId())
                        .accountId(record.getAccountId())
                        .source(IncomeSource.OTHER)
                        .paymentMode(IncomePaymentMode.BANK_ACCOUNT)
                        .amount(request.getAmount())
                        .incomeDate(today)
                        .periodMonth(today.getMonthValue())
                        .periodYear(today.getYear())
                        .description(label)
                        .debt(true)
                        .build();
                linkedEntryId = incomeRepository.save(income).getId();
            } else {
                // Money went out — debit the account
                Expense expense = Expense.builder()
                        .userId(record.getUserId())
                        .categoryId(DEBT_LOANS_CATEGORY_ID)
                        .accountId(record.getAccountId())
                        .amount(request.getAmount())
                        .expenseDate(today)
                        .description(label)
                        .debt(true)
                        .build();
                linkedEntryId = expenseRepository.save(expense).getId();
            }
        }

        DebtPayment payment = DebtPayment.builder()
                .debtId(record.getId())
                .amount(request.getAmount())
                .note(request.getNote())
                .linkedEntryId(linkedEntryId)
                .build();
        debtPaymentRepository.save(payment);

        BigDecimal settled = record.getAmountSettled().add(request.getAmount());
        record.setAmountSettled(settled);
        record.setStatus(settled.compareTo(record.getAmount()) >= 0 ? DebtStatus.SETTLED : DebtStatus.PARTIAL);
        return toResponse(debtRecordRepository.save(record));
    }

    @Override
    @Transactional
    public DebtRecordResponse settle(UUID id, UUID userId) {
        DebtRecord record = findOwned(id, userId);
        BigDecimal remaining = record.getAmount().subtract(record.getAmountSettled()).max(BigDecimal.ZERO);

        // Create an account entry for the remaining amount (if any) and record a final payment
        if (remaining.compareTo(BigDecimal.ZERO) > 0 && record.getAccountId() != null) {
            LocalDate today = LocalDate.now();
            String label = record.getType() == DebtType.LENT
                    ? "Settled by " + record.getContactName()
                    : "Settled to " + record.getContactName();
            UUID linkedEntryId;
            if (record.getType() == DebtType.LENT) {
                IncomeEntry income = IncomeEntry.builder()
                        .userId(record.getUserId())
                        .accountId(record.getAccountId())
                        .source(IncomeSource.OTHER)
                        .paymentMode(IncomePaymentMode.BANK_ACCOUNT)
                        .amount(remaining)
                        .incomeDate(today)
                        .periodMonth(today.getMonthValue())
                        .periodYear(today.getYear())
                        .description(label)
                        .debt(true)
                        .build();
                linkedEntryId = incomeRepository.save(income).getId();
            } else {
                Expense expense = Expense.builder()
                        .userId(record.getUserId())
                        .categoryId(DEBT_LOANS_CATEGORY_ID)
                        .accountId(record.getAccountId())
                        .amount(remaining)
                        .expenseDate(today)
                        .description(label)
                        .debt(true)
                        .build();
                linkedEntryId = expenseRepository.save(expense).getId();
            }
            debtPaymentRepository.save(DebtPayment.builder()
                    .debtId(record.getId())
                    .amount(remaining)
                    .note("Settled")
                    .linkedEntryId(linkedEntryId)
                    .build());
        }

        record.setAmountSettled(record.getAmount());
        record.setStatus(DebtStatus.SETTLED);
        return toResponse(debtRecordRepository.save(record));
    }

    @Override
    @Transactional
    public void delete(UUID id, UUID userId) {
        DebtRecord record = findOwned(id, userId);

        // Reverse every payment-linked account entry before the CASCADE deletes the payments
        debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(record.getId()).forEach(p -> {
            if (p.getLinkedEntryId() != null) {
                if (record.getType() == DebtType.LENT) {
                    incomeRepository.deleteById(p.getLinkedEntryId());
                } else {
                    expenseRepository.deleteById(p.getLinkedEntryId());
                }
            }
        });

        // Reverse the initial account entry
        if (record.getLinkedExpenseId() != null)
            expenseRepository.deleteById(record.getLinkedExpenseId());
        if (record.getLinkedIncomeId() != null)
            incomeRepository.deleteById(record.getLinkedIncomeId());

        debtRecordRepository.delete(record); // ON DELETE CASCADE removes debt_payments
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private DebtRecord findOwned(UUID id, UUID userId) {
        DebtRecord record = debtRecordRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("DebtRecord", "id", id));
        if (!record.getUserId().equals(userId)) throw new AccessDeniedException("Not your debt record");
        return record;
    }

    private DebtRecordResponse toResponse(DebtRecord r) {
        List<DebtPaymentResponse> payments = debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(r.getId())
                .stream()
                .map(p -> DebtPaymentResponse.builder()
                        .id(p.getId()).amount(p.getAmount()).note(p.getNote()).paidAt(p.getPaidAt())
                        .build())
                .toList();

        BigDecimal remaining = r.getAmount().subtract(r.getAmountSettled()).max(BigDecimal.ZERO);

        String accountName = null;
        if (r.getAccountId() != null) {
            accountName = accountRepository.findById(r.getAccountId())
                    .map(a -> a.getName()).orElse(null);
        }

        return DebtRecordResponse.builder()
                .id(r.getId())
                .accountId(r.getAccountId())
                .accountName(accountName)
                .type(r.getType().name())
                .contactName(r.getContactName())
                .contactPhone(r.getContactPhone())
                .amount(r.getAmount())
                .description(r.getDescription())
                .dueDate(r.getDueDate())
                .status(r.getStatus().name())
                .amountSettled(r.getAmountSettled())
                .amountRemaining(remaining)
                .payments(payments)
                .createdAt(r.getCreatedAt())
                .build();
    }
}
