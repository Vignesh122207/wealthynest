package com.wealthynest.domain.income.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.dto.request.UpdateIncomeRequest;
import com.wealthynest.domain.income.dto.response.IncomeResponse;
import com.wealthynest.domain.income.entity.IncomeEntry;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.entity.IncomeSource;
import com.wealthynest.domain.income.repository.IncomeRepository;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IncomeServiceImplTest {

    @Mock private IncomeRepository                incomeRepository;
    @Mock private AccountOwnershipGuard            accountOwnershipGuard;
    @Mock private InvestmentIncomeLogRepository    investmentIncomeLogRepository;

    @InjectMocks
    private IncomeServiceImpl service;

    private final UUID userId    = UUID.randomUUID();
    private final UUID entryId   = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    private IncomeEntry baseEntry() {
        IncomeEntry e = IncomeEntry.builder().id(entryId).userId(userId).accountId(accountId)
                .source(IncomeSource.SALARY).amount(new BigDecimal("50000")).incomeDate(LocalDate.now())
                .periodMonth(6).periodYear(2026).build();
        return e;
    }

    // ─── create ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("validates account ownership before saving")
        void validatesAccountOwnership() {
            CreateIncomeRequest req = mock(CreateIncomeRequest.class);
            when(req.getAccountId()).thenReturn(accountId);
            when(req.getSource()).thenReturn(IncomeSource.SALARY);
            when(req.getAmount()).thenReturn(new BigDecimal("1000"));
            when(req.getIncomeDate()).thenReturn(LocalDate.now());
            when(incomeRepository.save(any(IncomeEntry.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(accountId, userId);
        }

        @Test
        @DisplayName("defaults paymentMode to BANK_ACCOUNT when the request omits it")
        void defaultsPaymentModeToBankAccount() {
            CreateIncomeRequest req = mock(CreateIncomeRequest.class);
            when(req.getSource()).thenReturn(IncomeSource.SALARY);
            when(req.getAmount()).thenReturn(new BigDecimal("1000"));
            when(req.getIncomeDate()).thenReturn(LocalDate.now());
            when(req.getPaymentMode()).thenReturn(null);
            when(incomeRepository.save(any(IncomeEntry.class))).thenAnswer(inv -> inv.getArgument(0));

            IncomeResponse response = service.create(userId, req);

            assertThat(response.getPaymentMode()).isEqualTo("BANK_ACCOUNT");
        }

        @Test
        @DisplayName("uses the request's explicit paymentMode when provided")
        void usesExplicitPaymentMode() {
            CreateIncomeRequest req = mock(CreateIncomeRequest.class);
            when(req.getSource()).thenReturn(IncomeSource.FREELANCE);
            when(req.getAmount()).thenReturn(new BigDecimal("1000"));
            when(req.getIncomeDate()).thenReturn(LocalDate.now());
            when(req.getPaymentMode()).thenReturn(IncomePaymentMode.CASH);
            when(incomeRepository.save(any(IncomeEntry.class))).thenAnswer(inv -> inv.getArgument(0));

            IncomeResponse response = service.create(userId, req);

            assertThat(response.getPaymentMode()).isEqualTo("CASH");
        }
    }

    // ─── update ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(incomeRepository.findById(entryId)).thenReturn(Optional.empty());
            UpdateIncomeRequest req = mock(UpdateIncomeRequest.class);
            assertThatThrownBy(() -> service.update(entryId, userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's income entry")
        void throwsWhenNotOwned() {
            IncomeEntry entry = baseEntry();
            entry.setUserId(UUID.randomUUID());
            when(incomeRepository.findById(entryId)).thenReturn(Optional.of(entry));
            UpdateIncomeRequest req = mock(UpdateIncomeRequest.class);
            assertThatThrownBy(() -> service.update(entryId, userId, req)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("changing the account re-validates ownership of the new account")
        void changingAccountRevalidatesOwnership() {
            IncomeEntry entry = baseEntry();
            when(incomeRepository.findById(entryId)).thenReturn(Optional.of(entry));
            when(incomeRepository.save(any(IncomeEntry.class))).thenAnswer(inv -> inv.getArgument(0));
            UUID newAccountId = UUID.randomUUID();
            UpdateIncomeRequest req = mock(UpdateIncomeRequest.class);
            when(req.getAccountId()).thenReturn(newAccountId);

            service.update(entryId, userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(newAccountId, userId);
            assertThat(entry.getAccountId()).isEqualTo(newAccountId);
        }

        @Test
        @DisplayName("only updates fields present in the request (partial update)")
        void partialUpdate() {
            IncomeEntry entry = baseEntry();
            when(incomeRepository.findById(entryId)).thenReturn(Optional.of(entry));
            when(incomeRepository.save(any(IncomeEntry.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateIncomeRequest req = mock(UpdateIncomeRequest.class);
            when(req.getDescription()).thenReturn("Updated");

            service.update(entryId, userId, req);

            assertThat(entry.getAmount()).isEqualByComparingTo("50000"); // unchanged
            assertThat(entry.getDescription()).isEqualTo("Updated");
            verifyNoInteractions(accountOwnershipGuard); // accountId untouched -> guard not re-run
        }
    }

    // ─── delete ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class DeleteTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(incomeRepository.findById(entryId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.delete(entryId, userId)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("clears the investment-income-log back-reference BEFORE deleting the entry (no ON DELETE policy)")
        void clearsBackReferenceBeforeDeleting() {
            IncomeEntry entry = baseEntry();
            when(incomeRepository.findById(entryId)).thenReturn(Optional.of(entry));

            service.delete(entryId, userId);

            InOrder order = inOrder(investmentIncomeLogRepository, incomeRepository);
            order.verify(investmentIncomeLogRepository).clearIncomeEntryId(entryId);
            order.verify(incomeRepository).delete(entry);
        }
    }

    // ─── getAll / getByPeriod: includeDebt branching ────────────────────────────

    @Nested
    @DisplayName("getAll / getByPeriod: includeDebt branching")
    class QueryBranchingTests {

        @Test
        @DisplayName("getAll(userId, false) excludes debt entries via the debt-false query")
        void getAllExcludesDebtByDefault() {
            when(incomeRepository.findByUserIdAndDebtFalseOrderByIncomeDateDesc(userId)).thenReturn(java.util.List.of());
            service.getAll(userId, false);
            verify(incomeRepository).findByUserIdAndDebtFalseOrderByIncomeDateDesc(userId);
            verify(incomeRepository, never()).findByUserIdOrderByIncomeDateDesc(any());
        }

        @Test
        @DisplayName("getAll(userId, true) includes debt entries via the unfiltered query")
        void getAllIncludesDebtWhenRequested() {
            when(incomeRepository.findByUserIdOrderByIncomeDateDesc(userId)).thenReturn(java.util.List.of());
            service.getAll(userId, true);
            verify(incomeRepository).findByUserIdOrderByIncomeDateDesc(userId);
            verify(incomeRepository, never()).findByUserIdAndDebtFalseOrderByIncomeDateDesc(any());
        }

        @Test
        @DisplayName("getByPeriod(..., true) includes debt entries via the unfiltered period query")
        void getByPeriodIncludesDebtWhenRequested() {
            when(incomeRepository.findByUserIdAndPeriodYearAndPeriodMonthOrderByIncomeDateDesc(userId, 2026, 6))
                    .thenReturn(java.util.List.of());
            service.getByPeriod(userId, 2026, 6, true);
            verify(incomeRepository).findByUserIdAndPeriodYearAndPeriodMonthOrderByIncomeDateDesc(userId, 2026, 6);
        }
    }
}
