package com.wealthynest.domain.debt.service;

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
import com.wealthynest.domain.debt.dto.response.DebtRecordResponse;
import com.wealthynest.domain.debt.entity.DebtPayment;
import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtStatus;
import com.wealthynest.domain.debt.entity.DebtType;
import com.wealthynest.domain.debt.repository.DebtPaymentRepository;
import com.wealthynest.domain.debt.repository.DebtRecordRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DebtServiceImplTest {

    @Mock private DebtRecordRepository      debtRecordRepository;
    @Mock private DebtPaymentRepository     debtPaymentRepository;
    @Mock private WalletAccountRepository   accountRepository;
    @Mock private AccountOwnershipGuard     accountOwnershipGuard;
    @Mock private AccountBalanceGuard       accountBalanceGuard;
    @Mock private AccountTransferRepository transferRepository;

    @InjectMocks
    private DebtServiceImpl service;

    private final UUID userId    = UUID.randomUUID();
    private final UUID debtId    = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    // ── Shared factory helpers ────────────────────────────────────────────────────

    private DebtRecord.DebtRecordBuilder baseRecord() {
        return DebtRecord.builder()
                .userId(userId).type(DebtType.LENT).contactName("Alice")
                .amount(new BigDecimal("1000")).amountSettled(BigDecimal.ZERO)
                .status(DebtStatus.ACTIVE);
    }

    private DebtRecord withId(DebtRecord r) {
        ReflectionTestUtils.setField(r, "id", debtId);
        return r;
    }

    private CreateDebtRequest createRequest(DebtType type, UUID accId, String contact, BigDecimal amount, String description) {
        CreateDebtRequest req = mock(CreateDebtRequest.class);
        lenient().when(req.getType()).thenReturn(type);
        lenient().when(req.getAccountId()).thenReturn(accId);
        lenient().when(req.getContactName()).thenReturn(contact);
        lenient().when(req.getAmount()).thenReturn(amount);
        lenient().when(req.getDescription()).thenReturn(description);
        lenient().when(req.getDebtDate()).thenReturn(null);
        lenient().when(req.getDueDate()).thenReturn(null);
        return req;
    }

    private UpdateDebtRequest updateRequest(String contact, String phone, BigDecimal amount, String description) {
        UpdateDebtRequest req = mock(UpdateDebtRequest.class);
        lenient().when(req.getContactName()).thenReturn(contact);
        lenient().when(req.getContactPhone()).thenReturn(phone);
        lenient().when(req.getAmount()).thenReturn(amount);
        lenient().when(req.getDescription()).thenReturn(description);
        lenient().when(req.getDebtDate()).thenReturn(null);
        lenient().when(req.getDueDate()).thenReturn(null);
        return req;
    }

    private void stubSaveEcho() {
        when(debtRecordRepository.save(any(DebtRecord.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private void stubEmptyPaymentsAndTransfer() {
        lenient().when(debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(any())).thenReturn(List.of());
        lenient().when(transferRepository.save(any(AccountTransfer.class))).thenAnswer(inv -> {
            AccountTransfer t = inv.getArgument(0);
            ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
            return t;
        });
    }

    // ─── create ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("creates a debt record with no linked transfer when no account is given")
        void createsWithoutAccount() {
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            CreateDebtRequest req = createRequest(DebtType.LENT, null, "Alice", new BigDecimal("500"), null);

            DebtRecordResponse response = service.create(userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(null, userId);
            verify(transferRepository, never()).save(any());
            assertThat(response.getAmount()).isEqualByComparingTo("500");
            assertThat(response.getStatus()).isEqualTo("ACTIVE");
        }

        @Test
        @DisplayName("LENT with account: transfer debits the account (fromAccountId set), default label 'Lent to X'")
        void createsLentWithAccount() {
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            CreateDebtRequest req = createRequest(DebtType.LENT, accountId, "Alice", new BigDecimal("500"), null);

            service.create(userId, req);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            AccountTransfer t = captor.getValue();
            assertThat(t.getFromAccountId()).isEqualTo(accountId);
            assertThat(t.getToAccountId()).isNull();
            assertThat(t.getDebtLabel()).isEqualTo("LENT");
            assertThat(t.getDescription()).isEqualTo("Lent to Alice");
            assertThat(t.isDebt()).isTrue();
        }

        @Test
        @DisplayName("BORROWED with account: transfer credits the account (toAccountId set), default label 'Borrowed from X'")
        void createsBorrowedWithAccount() {
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            CreateDebtRequest req = createRequest(DebtType.BORROWED, accountId, "Bob", new BigDecimal("500"), null);

            service.create(userId, req);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            AccountTransfer t = captor.getValue();
            assertThat(t.getFromAccountId()).isNull();
            assertThat(t.getToAccountId()).isEqualTo(accountId);
            assertThat(t.getDebtLabel()).isEqualTo("BORROWED");
            assertThat(t.getDescription()).isEqualTo("Borrowed from Bob");
        }

        @Test
        @DisplayName("a custom description overrides the default LENT/BORROWED label")
        void customDescriptionOverridesDefault() {
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            CreateDebtRequest req = createRequest(DebtType.LENT, accountId, "Alice", new BigDecimal("500"), "Emergency loan");

            service.create(userId, req);

            ArgumentCaptor<AccountTransfer> captor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(captor.capture());
            assertThat(captor.getValue().getDescription()).isEqualTo("Emergency loan");
        }

        @Test
        @DisplayName("links the saved transfer id back onto the debt record, saving it a second time")
        void linksTransferIdOntoRecord() {
            when(debtRecordRepository.save(any(DebtRecord.class))).thenAnswer(inv -> inv.getArgument(0));
            stubEmptyPaymentsAndTransfer();
            CreateDebtRequest req = createRequest(DebtType.LENT, accountId, "Alice", new BigDecimal("500"), null);

            service.create(userId, req);

            verify(debtRecordRepository, times(2)).save(any(DebtRecord.class));
        }
    }

    // ─── update ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the debt does not exist")
        void throwsWhenNotFound() {
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.empty());
            UpdateDebtRequest req = updateRequest("Alice", null, null, null);

            assertThatThrownBy(() -> service.update(debtId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("only updates fields present in the request (partial update)")
        void partialUpdate() {
            DebtRecord record = withId(baseRecord().contactPhone("111").build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, null, "New note");

            service.update(debtId, userId, req);

            assertThat(record.getContactName()).isEqualTo("Alice"); // unchanged
            assertThat(record.getContactPhone()).isEqualTo("111");  // unchanged
            assertThat(record.getDescription()).isEqualTo("New note");
        }

        @Test
        @DisplayName("changing contactName syncs the linked transfer's debtContactName when one exists")
        void contactNameSyncsLinkedTransfer() {
            UUID transferId = UUID.randomUUID();
            DebtRecord record = withId(baseRecord().linkedTransferId(transferId).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            AccountTransfer transfer = AccountTransfer.builder().debtContactName("Alice").build();
            when(transferRepository.findById(transferId)).thenReturn(Optional.of(transfer));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest("Alice Renamed", null, null, null);

            service.update(debtId, userId, req);

            assertThat(transfer.getDebtContactName()).isEqualTo("Alice Renamed");
            verify(transferRepository).save(transfer);
        }

        @Test
        @DisplayName("changing contactName does nothing to transfers when there is no linked transfer")
        void contactNameNoOpWithoutLinkedTransfer() {
            DebtRecord record = withId(baseRecord().linkedTransferId(null).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest("Renamed", null, null, null);

            service.update(debtId, userId, req);

            verify(transferRepository, never()).findById(any());
        }

        @Test
        @DisplayName("changing the amount to a different value syncs the linked transfer's amount")
        void amountChangeSyncsLinkedTransfer() {
            UUID transferId = UUID.randomUUID();
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).linkedTransferId(transferId).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            AccountTransfer transfer = AccountTransfer.builder().amount(new BigDecimal("1000")).build();
            when(transferRepository.findById(transferId)).thenReturn(Optional.of(transfer));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, new BigDecimal("1500"), null);

            service.update(debtId, userId, req);

            assertThat(transfer.getAmount()).isEqualByComparingTo("1500");
        }

        @Test
        @DisplayName("setting the amount to the same value does not touch the linked transfer")
        void amountUnchangedSkipsSync() {
            UUID transferId = UUID.randomUUID();
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).linkedTransferId(transferId).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, new BigDecimal("1000"), null);

            service.update(debtId, userId, req);

            verify(transferRepository, never()).findById(any());
        }

        // Regression: update() used to leave `status` completely untouched after an amount edit,
        // so it could drift arbitrarily far from the true amount/amountSettled relationship —
        // either a SETTLED debt silently gaining a real positive remaining with no way to pay it
        // off (Pay Back is hidden client-side once settled), or a PARTIAL/ACTIVE debt stuck
        // forever with 0 real remaining and a Pay Back button that always 400s (any positive
        // payment exceeds the now-negative unfloored remaining recordPayment validates against).

        @Test
        @DisplayName("raising the amount above amountSettled un-settles an already-SETTLED debt")
        void raisingAmountUnsettlesSettledDebt() {
            DebtRecord record = withId(baseRecord()
                    .amount(new BigDecimal("1000")).amountSettled(new BigDecimal("1000"))
                    .status(DebtStatus.SETTLED).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, new BigDecimal("1500"), null);

            service.update(debtId, userId, req);

            assertThat(record.getStatus()).isEqualTo(DebtStatus.PARTIAL);
        }

        @Test
        @DisplayName("lowering the amount to/below amountSettled settles a PARTIAL debt instead of leaving it stuck")
        void loweringAmountBelowSettledSettlesDebt() {
            DebtRecord record = withId(baseRecord()
                    .amount(new BigDecimal("1000")).amountSettled(new BigDecimal("600"))
                    .status(DebtStatus.PARTIAL).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, new BigDecimal("500"), null);

            service.update(debtId, userId, req);

            assertThat(record.getStatus()).isEqualTo(DebtStatus.SETTLED);
        }

        @Test
        @DisplayName("changing the amount on a debt with no payments yet keeps status ACTIVE")
        void amountChangeWithNoPaymentsStaysActive() {
            DebtRecord record = withId(baseRecord()
                    .amount(new BigDecimal("1000")).amountSettled(BigDecimal.ZERO)
                    .status(DebtStatus.ACTIVE).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            UpdateDebtRequest req = updateRequest(null, null, new BigDecimal("2000"), null);

            service.update(debtId, userId, req);

            assertThat(record.getStatus()).isEqualTo(DebtStatus.ACTIVE);
        }
    }

    // ─── recordPayment ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("recordPayment")
    class RecordPaymentTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the debt does not exist")
        void throwsWhenNotFound() {
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.empty());
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);

            assertThatThrownBy(() -> service.recordPayment(debtId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws a CONFLICT BusinessException when the debt is already SETTLED")
        void throwsWhenAlreadySettled() {
            DebtRecord record = withId(baseRecord().status(DebtStatus.SETTLED).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            lenient().when(req.getAmount()).thenReturn(new BigDecimal("100"));

            assertThatThrownBy(() -> service.recordPayment(debtId, userId, req))
                    .isInstanceOf(BusinessException.class)
                    .extracting(ex -> ((BusinessException) ex).getStatus())
                    .isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
        }

        @Test
        @DisplayName("throws BusinessException when the payment exceeds the remaining balance")
        void throwsWhenPaymentExceedsRemaining() {
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("800")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("500")); // remaining is only 200

            assertThatThrownBy(() -> service.recordPayment(debtId, userId, req))
                    .isInstanceOf(BusinessException.class);
            verify(debtPaymentRepository, never()).save(any());
        }

        @Test
        @DisplayName("BORROWED repayment checks account balance sufficiency before proceeding")
        void borrowedChecksBalanceGuard() {
            DebtRecord record = withId(baseRecord().type(DebtType.BORROWED).accountId(accountId)
                    .amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.recordPayment(debtId, userId, req);

            verify(accountBalanceGuard).validateSufficientBalance(accountId, userId, new BigDecimal("300"), BigDecimal.ZERO);
        }

        @Test
        @DisplayName("LENT repayment does NOT check account balance sufficiency (money is coming in, not out)")
        void lentSkipsBalanceGuard() {
            DebtRecord record = withId(baseRecord().type(DebtType.LENT).accountId(accountId)
                    .amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.recordPayment(debtId, userId, req);

            verify(accountBalanceGuard, never()).validateSufficientBalance(any(), any(), any(), any());
        }

        @Test
        @DisplayName("a partial payment sets status to PARTIAL and accumulates amountSettled")
        void partialPaymentSetsStatusPartial() {
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("200")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            DebtRecordResponse response = service.recordPayment(debtId, userId, req);

            assertThat(record.getAmountSettled()).isEqualByComparingTo("500");
            assertThat(record.getStatus()).isEqualTo(DebtStatus.PARTIAL);
            assertThat(response.getStatus()).isEqualTo("PARTIAL");
        }

        @Test
        @DisplayName("a payment that exactly covers the remaining balance sets status to SETTLED")
        void fullPaymentSetsStatusSettled() {
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("700")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.recordPayment(debtId, userId, req);

            assertThat(record.getStatus()).isEqualTo(DebtStatus.SETTLED);
        }

        @Test
        @DisplayName("with an account, creates a REPAID transfer in the correct direction and links it to the payment")
        void createsRepaidTransferLinkedToPayment() {
            DebtRecord record = withId(baseRecord().type(DebtType.BORROWED).accountId(accountId)
                    .amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            lenient().when(req.getNote()).thenReturn(null);
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            ArgumentCaptor<DebtPayment> paymentCaptor = ArgumentCaptor.forClass(DebtPayment.class);
            when(debtPaymentRepository.save(paymentCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.recordPayment(debtId, userId, req);

            ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(transferCaptor.capture());
            AccountTransfer t = transferCaptor.getValue();
            assertThat(t.getFromAccountId()).isEqualTo(accountId); // BORROWED repayment debits the account
            assertThat(t.getDebtLabel()).isEqualTo("REPAID");
            assertThat(t.getDescription()).isEqualTo("Paid to Alice");
            assertThat(paymentCaptor.getValue().getLinkedEntryId()).isEqualTo(t.getId());
        }

        @Test
        @DisplayName("without an account, no transfer is created and the payment's linkedEntryId stays null")
        void noAccountNoTransfer() {
            DebtRecord record = withId(baseRecord().accountId(null).amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            ArgumentCaptor<DebtPayment> paymentCaptor = ArgumentCaptor.forClass(DebtPayment.class);
            when(debtPaymentRepository.save(paymentCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.recordPayment(debtId, userId, req);

            verify(transferRepository, never()).save(any());
            assertThat(paymentCaptor.getValue().getLinkedEntryId()).isNull();
        }

        @Test
        @DisplayName("when paidAt is provided, the linked transfer and the payment's own paidAt use that date instead of today")
        void usesProvidedPaidAtForTransferAndPayment() {
            DebtRecord record = withId(baseRecord().type(DebtType.BORROWED).accountId(accountId)
                    .amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            LocalDate backdated = LocalDate.now().minusDays(5);
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            lenient().when(req.getNote()).thenReturn(null);
            when(req.getPaidAt()).thenReturn(backdated);
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            ArgumentCaptor<DebtPayment> paymentCaptor = ArgumentCaptor.forClass(DebtPayment.class);
            when(debtPaymentRepository.save(paymentCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.recordPayment(debtId, userId, req);

            ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(transferCaptor.capture());
            assertThat(transferCaptor.getValue().getTransferDate()).isEqualTo(backdated);
            assertThat(paymentCaptor.getValue().getPaidAt())
                    .isEqualTo(backdated.atStartOfDay().toInstant(ZoneOffset.UTC));
        }

        @Test
        @DisplayName("when paidAt is omitted, the payment's own paidAt defaults to today")
        void defaultsPaidAtToToday() {
            DebtRecord record = withId(baseRecord().accountId(null).amount(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            RecordPaymentRequest req = mock(RecordPaymentRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("300"));
            lenient().when(req.getPaidAt()).thenReturn(null);
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            ArgumentCaptor<DebtPayment> paymentCaptor = ArgumentCaptor.forClass(DebtPayment.class);
            when(debtPaymentRepository.save(paymentCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.recordPayment(debtId, userId, req);

            assertThat(paymentCaptor.getValue().getPaidAt())
                    .isEqualTo(LocalDate.now().atStartOfDay().toInstant(ZoneOffset.UTC));
        }
    }

    // ─── deletePayment ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deletePayment")
    class DeletePaymentTests {

        private final UUID paymentId = UUID.randomUUID();

        @Test
        @DisplayName("throws when the debt does not exist or isn't owned")
        void throwsWhenDebtNotFound() {
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deletePayment(debtId, paymentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(debtPaymentRepository, never()).delete(any());
        }

        @Test
        @DisplayName("throws when the payment does not exist")
        void throwsWhenPaymentNotFound() {
            DebtRecord record = withId(baseRecord().build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            when(debtPaymentRepository.findById(paymentId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deletePayment(debtId, paymentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws when the payment belongs to a different debt")
        void throwsWhenPaymentBelongsToAnotherDebt() {
            DebtRecord record = withId(baseRecord().build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            DebtPayment payment = DebtPayment.builder().debtId(UUID.randomUUID()).amount(new BigDecimal("100")).build();
            when(debtPaymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));

            assertThatThrownBy(() -> service.deletePayment(debtId, paymentId, userId))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(debtPaymentRepository, never()).delete(any());
        }

        @Test
        @DisplayName("reverses the payment's linked transfer, subtracts it from amountSettled, and deletes it")
        void reversesTransferAndSubtractsAmount() {
            UUID transferId = UUID.randomUUID();
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("500"))
                    .status(DebtStatus.PARTIAL).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            DebtPayment payment = DebtPayment.builder().debtId(debtId).amount(new BigDecimal("200")).linkedEntryId(transferId).build();
            when(debtPaymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            DebtRecordResponse response = service.deletePayment(debtId, paymentId, userId);

            verify(transferRepository).deleteById(transferId);
            verify(debtPaymentRepository).delete(payment);
            assertThat(record.getAmountSettled()).isEqualByComparingTo("300");
            assertThat(record.getStatus()).isEqualTo(DebtStatus.PARTIAL);
            assertThat(response.getAmountSettled()).isEqualByComparingTo("300");
        }

        @Test
        @DisplayName("skips transfer reversal when the payment has no linked transfer")
        void skipsTransferReversalWhenAbsent() {
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("200"))
                    .status(DebtStatus.PARTIAL).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            DebtPayment payment = DebtPayment.builder().debtId(debtId).amount(new BigDecimal("200")).linkedEntryId(null).build();
            when(debtPaymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.deletePayment(debtId, paymentId, userId);

            verify(transferRepository, never()).deleteById(any());
            assertThat(record.getAmountSettled()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("removing the payment that fully settled a debt reverts its status to PARTIAL/ACTIVE")
        void revertingLastPaymentUnsettlesDebt() {
            DebtRecord record = withId(baseRecord().amount(new BigDecimal("1000")).amountSettled(new BigDecimal("1000"))
                    .status(DebtStatus.SETTLED).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            DebtPayment payment = DebtPayment.builder().debtId(debtId).amount(new BigDecimal("1000")).linkedEntryId(null).build();
            when(debtPaymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            DebtRecordResponse response = service.deletePayment(debtId, paymentId, userId);

            assertThat(record.getStatus()).isEqualTo(DebtStatus.ACTIVE);
            assertThat(response.getStatus()).isEqualTo("ACTIVE");
        }
    }

    // ─── settle ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("settle")
    class SettleTests {

        @Test
        @DisplayName("throws when the debt does not exist or isn't owned")
        void throwsWhenNotFound() {
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.settle(debtId, userId)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("with a remaining balance and an account, creates a final REPAID transfer + payment for the remainder")
        void settlesRemainingBalanceWithTransfer() {
            DebtRecord record = withId(baseRecord().type(DebtType.LENT).accountId(accountId)
                    .amount(new BigDecimal("1000")).amountSettled(new BigDecimal("600")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();
            ArgumentCaptor<DebtPayment> paymentCaptor = ArgumentCaptor.forClass(DebtPayment.class);
            when(debtPaymentRepository.save(paymentCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            DebtRecordResponse response = service.settle(debtId, userId);

            ArgumentCaptor<AccountTransfer> transferCaptor = ArgumentCaptor.forClass(AccountTransfer.class);
            verify(transferRepository).save(transferCaptor.capture());
            assertThat(transferCaptor.getValue().getAmount()).isEqualByComparingTo("400"); // 1000 - 600
            assertThat(transferCaptor.getValue().getToAccountId()).isEqualTo(accountId); // LENT settlement credits the account
            assertThat(paymentCaptor.getValue().getNote()).isEqualTo("Settled");
            assertThat(record.getStatus()).isEqualTo(DebtStatus.SETTLED);
            assertThat(record.getAmountSettled()).isEqualByComparingTo("1000");
            assertThat(response.getAmountRemaining()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("when already fully paid (remaining = 0), settling creates no extra transfer or payment")
        void noExtraTransferWhenAlreadyFullyPaid() {
            DebtRecord record = withId(baseRecord().accountId(accountId)
                    .amount(new BigDecimal("1000")).amountSettled(new BigDecimal("1000")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.settle(debtId, userId);

            verify(transferRepository, never()).save(any());
            verify(debtPaymentRepository, never()).save(any());
            assertThat(record.getStatus()).isEqualTo(DebtStatus.SETTLED);
        }

        @Test
        @DisplayName("without an account, no transfer is created even with a remaining balance")
        void noTransferWithoutAccount() {
            DebtRecord record = withId(baseRecord().accountId(null)
                    .amount(new BigDecimal("1000")).amountSettled(new BigDecimal("600")).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            stubSaveEcho();
            stubEmptyPaymentsAndTransfer();

            service.settle(debtId, userId);

            verify(transferRepository, never()).save(any());
            assertThat(record.getStatus()).isEqualTo(DebtStatus.SETTLED);
            assertThat(record.getAmountSettled()).isEqualByComparingTo("1000");
        }
    }

    // ─── delete ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class DeleteTests {

        @Test
        @DisplayName("throws when the debt does not exist or isn't owned")
        void throwsWhenNotFound() {
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.delete(debtId, userId)).isInstanceOf(ResourceNotFoundException.class);
            verify(debtRecordRepository, never()).delete(any());
        }

        @Test
        @DisplayName("reverses every payment-linked transfer, the initial transfer, then deletes the record")
        void reversesAllLinkedTransfersThenDeletes() {
            UUID initialTransferId = UUID.randomUUID();
            UUID payment1TransferId = UUID.randomUUID();
            DebtRecord record = withId(baseRecord().linkedTransferId(initialTransferId).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));

            DebtPayment paidWithTransfer = DebtPayment.builder().debtId(debtId).linkedEntryId(payment1TransferId).build();
            DebtPayment paidWithoutTransfer = DebtPayment.builder().debtId(debtId).linkedEntryId(null).build();
            when(debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(debtId))
                    .thenReturn(List.of(paidWithTransfer, paidWithoutTransfer));

            service.delete(debtId, userId);

            verify(transferRepository).deleteById(payment1TransferId);
            verify(transferRepository).deleteById(initialTransferId);
            verify(transferRepository, times(2)).deleteById(any());
            verify(debtRecordRepository).delete(record);
        }

        @Test
        @DisplayName("skips the initial-transfer deletion when the record has none")
        void skipsInitialTransferDeletionWhenAbsent() {
            DebtRecord record = withId(baseRecord().linkedTransferId(null).build());
            when(debtRecordRepository.findByIdAndUserId(debtId, userId)).thenReturn(Optional.of(record));
            when(debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(debtId)).thenReturn(List.of());

            service.delete(debtId, userId);

            verify(transferRepository, never()).deleteById(any());
            verify(debtRecordRepository).delete(record);
        }
    }

    // ─── getAll / getByType ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAll / getByType")
    class QueryTests {

        @Test
        @DisplayName("getAll maps each record to a response with resolved account name and payment history")
        void getAllMapsAccountNameAndPayments() {
            DebtRecord record = withId(baseRecord().accountId(accountId).build());
            when(debtRecordRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(record));
            when(debtPaymentRepository.findByDebtIdOrderByPaidAtDesc(debtId))
                    .thenReturn(List.of(DebtPayment.builder().amount(new BigDecimal("100")).note("part 1").build()));
            var account = com.wealthynest.domain.account.entity.WalletAccount.builder().name("HDFC Savings").build();
            when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

            List<DebtRecordResponse> result = service.getAll(userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getAccountName()).isEqualTo("HDFC Savings");
            assertThat(result.get(0).getPayments()).hasSize(1);
        }

        @Test
        @DisplayName("getByType filters by the given debt type")
        void getByTypeDelegatesToRepository() {
            when(debtRecordRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, DebtType.BORROWED))
                    .thenReturn(List.of());

            List<DebtRecordResponse> result = service.getByType(userId, DebtType.BORROWED);

            assertThat(result).isEmpty();
            verify(debtRecordRepository).findByUserIdAndTypeOrderByCreatedAtDesc(userId, DebtType.BORROWED);
        }
    }
}
