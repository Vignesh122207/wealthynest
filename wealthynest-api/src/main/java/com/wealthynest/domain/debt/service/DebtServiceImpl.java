package com.wealthynest.domain.debt.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountTransfer;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountBalanceGuard;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
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
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * A debt is money leaving or entering your control, not spending or earning — so it's booked as a
 * one-sided AccountTransfer (one of fromAccountId/toAccountId null, the same shape balance
 * adjustments use), tagged debt=true with a contact name and a direction label (LENT/BORROWED/REPAID),
 * rather than as a synthetic Expense/Income row under a shared "Debt & Loans" category.
 */
@Service
@RequiredArgsConstructor
public class DebtServiceImpl implements DebtService {

    private final DebtRecordRepository    debtRecordRepository;
    private final DebtPaymentRepository   debtPaymentRepository;
    private final WalletAccountRepository accountRepository;
    private final AccountOwnershipGuard   accountOwnershipGuard;
    private final AccountBalanceGuard     accountBalanceGuard;
    private final AccountTransferRepository transferRepository;

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
    @CacheEvict(value = "dashboard", allEntries = true)
    public DebtRecordResponse create(UUID userId, CreateDebtRequest request) {
        accountOwnershipGuard.validateAccountOwnership(request.getAccountId(), userId);
        DebtRecord record = DebtRecord.builder()
                .userId(userId)
                .type(request.getType())
                .accountId(request.getAccountId())
                .contactName(request.getContactName())
                .contactPhone(request.getContactPhone())
                .amount(request.getAmount())
                .description(request.getDescription())
                .debtDate(request.getDebtDate() != null ? request.getDebtDate() : LocalDate.now())
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

            boolean isLent = request.getType() == DebtType.LENT;
            AccountTransfer transfer = AccountTransfer.builder()
                    .userId(userId)
                    .fromAccountId(isLent ? request.getAccountId() : null)
                    .toAccountId(isLent ? null : request.getAccountId())
                    .amount(request.getAmount())
                    .description(label)
                    .debt(true)
                    .debtContactName(request.getContactName())
                    .debtLabel(isLent ? "LENT" : "BORROWED")
                    .transferDate(today)
                    .build();
            record.setLinkedTransferId(transferRepository.save(transfer).getId());
            record = debtRecordRepository.save(record);
        }

        return toResponse(record);
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public DebtRecordResponse update(UUID id, UUID userId, UpdateDebtRequest request) {
        DebtRecord record = findOwned(id, userId);
        if (request.getContactName()  != null) record.setContactName(request.getContactName());
        if (request.getContactPhone() != null) record.setContactPhone(request.getContactPhone());
        if (request.getDescription()  != null) record.setDescription(request.getDescription());
        if (request.getDebtDate()     != null) record.setDebtDate(request.getDebtDate());
        if (request.getDueDate()      != null) record.setDueDate(request.getDueDate());

        if (request.getContactName() != null && record.getLinkedTransferId() != null) {
            transferRepository.findById(record.getLinkedTransferId()).ifPresent(t -> {
                t.setDebtContactName(request.getContactName());
                transferRepository.save(t);
            });
        }

        if (request.getAmount() != null && request.getAmount().compareTo(record.getAmount()) != 0) {
            record.setAmount(request.getAmount());
            // Keep the linked transfer in sync
            if (record.getLinkedTransferId() != null) {
                transferRepository.findById(record.getLinkedTransferId()).ifPresent(t -> {
                    t.setAmount(request.getAmount());
                    transferRepository.save(t);
                });
            }
            // Editing the amount can change which side of "fully paid" the debt is on in either
            // direction — raising it can un-settle an already-SETTLED debt (it now has a real
            // positive remaining, but a settled debt's Pay Back action is hidden client-side, so
            // there'd be no way to ever pay that off), and lowering it below what's already been
            // recorded as amountSettled should settle it, not leave status stuck on PARTIAL/ACTIVE
            // forever with a permanently-unusable Pay Back button (any positive payment would
            // exceed the — now negative — remaining balance recordPayment validates against).
            // Never touched status before; this keeps it honest relative to the real numbers.
            record.setStatus(computeStatus(record.getAmount(), record.getAmountSettled()));
        }

        return toResponse(debtRecordRepository.save(record));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public DebtRecordResponse recordPayment(UUID id, UUID userId, RecordPaymentRequest request) {
        DebtRecord record = findOwned(id, userId);
        if (record.getStatus() == DebtStatus.SETTLED)
            throw new BusinessException("Debt is already fully settled", HttpStatus.CONFLICT);

        BigDecimal remaining = record.getAmount().subtract(record.getAmountSettled());
        if (request.getAmount().compareTo(remaining) > 0) {
            throw new BusinessException(
                    "Payment of " + request.getAmount() + " exceeds the remaining balance of " + remaining + ".",
                    HttpStatus.BAD_REQUEST);
        }
        if (record.getType() == DebtType.BORROWED) {
            // Repaying a debt debits a real wallet account — same "can't go negative" rule as an expense.
            accountBalanceGuard.validateSufficientBalance(record.getAccountId(), userId, request.getAmount(), BigDecimal.ZERO);
        }

        // A payment can be logged as having happened on an earlier date rather than always dating
        // it to whenever it was typed in — same optional-with-today-default shape as
        // CreateDebtRequest's debtDate. Feeds both the linked transfer's date and the payment's
        // own paidAt so the two stay consistent with each other.
        LocalDate paidDate = request.getPaidAt() != null ? request.getPaidAt() : LocalDate.now();

        UUID linkedEntryId = null;
        if (record.getAccountId() != null) {
            String label = (request.getNote() != null && !request.getNote().isBlank())
                    ? request.getNote()
                    : (record.getType() == DebtType.LENT
                            ? "Received from " + record.getContactName()
                            : "Paid to " + record.getContactName());

            boolean isLent = record.getType() == DebtType.LENT;
            AccountTransfer transfer = AccountTransfer.builder()
                    .userId(record.getUserId())
                    .fromAccountId(isLent ? null : record.getAccountId())
                    .toAccountId(isLent ? record.getAccountId() : null)
                    .amount(request.getAmount())
                    .description(label)
                    .debt(true)
                    .debtContactName(record.getContactName())
                    .debtLabel("REPAID")
                    .transferDate(paidDate)
                    .build();
            linkedEntryId = transferRepository.save(transfer).getId();
        }

        DebtPayment payment = DebtPayment.builder()
                .debtId(record.getId())
                .amount(request.getAmount())
                .note(request.getNote())
                .linkedEntryId(linkedEntryId)
                .paidAt(paidDate.atStartOfDay().toInstant(ZoneOffset.UTC))
                .build();
        debtPaymentRepository.save(payment);

        BigDecimal settled = record.getAmountSettled().add(request.getAmount());
        record.setAmountSettled(settled);
        record.setStatus(settled.compareTo(record.getAmount()) >= 0 ? DebtStatus.SETTLED : DebtStatus.PARTIAL);
        return toResponse(debtRecordRepository.save(record));
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public DebtRecordResponse deletePayment(UUID id, UUID paymentId, UUID userId) {
        DebtRecord record = findOwned(id, userId);
        DebtPayment payment = debtPaymentRepository.findById(paymentId)
                .filter(p -> p.getDebtId().equals(id))
                .orElseThrow(() -> new ResourceNotFoundException("DebtPayment", "id", paymentId));

        // Reverse the payment's own account entry before removing it, same as delete()'s
        // per-payment reversal — a mis-logged payment shouldn't leave a stray transfer behind.
        if (payment.getLinkedEntryId() != null) transferRepository.deleteById(payment.getLinkedEntryId());
        debtPaymentRepository.delete(payment);

        BigDecimal settled = record.getAmountSettled().subtract(payment.getAmount()).max(BigDecimal.ZERO);
        record.setAmountSettled(settled);
        // Removing a payment can un-settle a SETTLED debt back to PARTIAL/ACTIVE — same boundary
        // recordPayment/update already cross in the other direction.
        record.setStatus(computeStatus(record.getAmount(), settled));
        return toResponse(debtRecordRepository.save(record));
    }

    /** Same ACTIVE/PARTIAL/SETTLED boundary recordPayment already applies after a payment —
     * factored out so update() can re-derive it after an amount edit too, since that can move
     * a debt across the same boundary in either direction. */
    private DebtStatus computeStatus(BigDecimal amount, BigDecimal amountSettled) {
        if (amountSettled.compareTo(BigDecimal.ZERO) <= 0) return DebtStatus.ACTIVE;
        return amountSettled.compareTo(amount) >= 0 ? DebtStatus.SETTLED : DebtStatus.PARTIAL;
    }

    @Override
    @Transactional
    @CacheEvict(value = "dashboard", allEntries = true)
    public DebtRecordResponse settle(UUID id, UUID userId) {
        DebtRecord record = findOwned(id, userId);
        BigDecimal remaining = record.getAmount().subtract(record.getAmountSettled()).max(BigDecimal.ZERO);

        // Create an account entry for the remaining amount (if any) and record a final payment
        if (remaining.compareTo(BigDecimal.ZERO) > 0 && record.getAccountId() != null) {
            LocalDate today = LocalDate.now();
            String label = record.getType() == DebtType.LENT
                    ? "Settled by " + record.getContactName()
                    : "Settled to " + record.getContactName();
            boolean isLent = record.getType() == DebtType.LENT;
            AccountTransfer transfer = AccountTransfer.builder()
                    .userId(record.getUserId())
                    .fromAccountId(isLent ? null : record.getAccountId())
                    .toAccountId(isLent ? record.getAccountId() : null)
                    .amount(remaining)
                    .description(label)
                    .debt(true)
                    .debtContactName(record.getContactName())
                    .debtLabel("REPAID")
                    .transferDate(today)
                    .build();
            UUID linkedEntryId = transferRepository.save(transfer).getId();
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
    @CacheEvict(value = "dashboard", allEntries = true)
    public void delete(UUID id, UUID userId) {
        DebtRecord record = findOwned(id, userId);

        // Reverse every payment-linked transfer before the CASCADE deletes the payments
        debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(record.getId()).forEach(p -> {
            if (p.getLinkedEntryId() != null) transferRepository.deleteById(p.getLinkedEntryId());
        });

        // Reverse the initial transfer
        if (record.getLinkedTransferId() != null)
            transferRepository.deleteById(record.getLinkedTransferId());

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
                .debtDate(r.getDebtDate())
                .dueDate(r.getDueDate())
                .status(r.getStatus().name())
                .amountSettled(r.getAmountSettled())
                .amountRemaining(remaining)
                .payments(payments)
                .createdAt(r.getCreatedAt())
                .build();
    }
}
