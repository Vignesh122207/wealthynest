package com.wealthynest.domain.liability.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.liability.dto.request.CreateLiabilityRequest;
import com.wealthynest.domain.liability.dto.response.LiabilityResponse;
import com.wealthynest.domain.liability.entity.Liability;
import com.wealthynest.domain.liability.entity.LiabilityType;
import com.wealthynest.domain.liability.mapper.LiabilityMapper;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LiabilityServiceImplTest {

    @Mock private LiabilityRepository  liabilityRepository;
    @Mock private LiabilityMapper      liabilityMapper;
    @Mock private WalletAccountService walletAccountService;

    @InjectMocks
    private LiabilityServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final UUID liabilityId = UUID.randomUUID();

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(liabilityMapper.toEntity(any())).thenAnswer(inv -> Liability.builder().build());
        lenient().when(liabilityMapper.toResponse(any(Liability.class))).thenAnswer(inv -> {
            Liability l = inv.getArgument(0);
            return LiabilityResponse.builder().id(l.getId()).name(l.getName())
                    .outstandingAmount(l.getOutstandingAmount()).build();
        });
        lenient().when(liabilityMapper.toResponseList(any())).thenReturn(List.of());
    }

    private CreateLiabilityRequest request(BigDecimal principal, BigDecimal outstanding) {
        CreateLiabilityRequest req = mock(CreateLiabilityRequest.class);
        lenient().when(req.getPrincipalAmount()).thenReturn(principal);
        lenient().when(req.getOutstandingAmount()).thenReturn(outstanding);
        lenient().when(req.getName()).thenReturn("Home Loan");
        lenient().when(req.getLiabilityType()).thenReturn(LiabilityType.HOME_LOAN);
        return req;
    }

    // ─── createLiability / updateLiability (outstanding <= principal invariant) ────

    @Nested
    @DisplayName("outstanding-vs-principal validation (shared by create and update)")
    class ValidationTests {

        @Test
        @DisplayName("create rejects outstanding greater than principal")
        void createRejectsOutstandingExceedingPrincipal() {
            CreateLiabilityRequest req = request(new BigDecimal("100000"), new BigDecimal("150000"));
            assertThatThrownBy(() -> service.createLiability(userId, null, req)).isInstanceOf(BusinessException.class);
            verify(liabilityRepository, never()).save(any());
        }

        @Test
        @DisplayName("create allows outstanding exactly equal to principal (boundary)")
        void createAllowsOutstandingEqualToPrincipal() {
            when(liabilityRepository.save(any(Liability.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateLiabilityRequest req = request(new BigDecimal("100000"), new BigDecimal("100000"));
            service.createLiability(userId, null, req); // no exception
            verify(liabilityRepository).save(any());
        }

        @Test
        @DisplayName("update rejects outstanding greater than principal too")
        void updateRejectsOutstandingExceedingPrincipal() {
            CreateLiabilityRequest req = request(new BigDecimal("50000"), new BigDecimal("60000"));
            assertThatThrownBy(() -> service.updateLiability(liabilityId, userId, req)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(liabilityRepository);
        }
    }

    // ─── createLiability ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("createLiability sets userId/familyId on the mapped entity before saving")
    void createLiabilitySetsOwnership() {
        UUID familyId = UUID.randomUUID();
        when(liabilityRepository.save(any(Liability.class))).thenAnswer(inv -> inv.getArgument(0));
        CreateLiabilityRequest req = request(new BigDecimal("100000"), new BigDecimal("50000"));

        service.createLiability(userId, familyId, req);

        var captor = org.mockito.ArgumentCaptor.forClass(Liability.class);
        verify(liabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getFamilyId()).isEqualTo(familyId);
    }

    // ─── updateLiability ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateLiability")
    class UpdateTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(liabilityRepository.findById(liabilityId)).thenReturn(Optional.empty());
            CreateLiabilityRequest req = request(new BigDecimal("100000"), new BigDecimal("50000"));
            assertThatThrownBy(() -> service.updateLiability(liabilityId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's liability")
        void throwsWhenNotOwned() {
            Liability liability = Liability.builder().userId(UUID.randomUUID()).build();
            ReflectionTestUtils.setField(liability, "id", liabilityId);
            when(liabilityRepository.findById(liabilityId)).thenReturn(Optional.of(liability));
            CreateLiabilityRequest req = request(new BigDecimal("100000"), new BigDecimal("50000"));
            assertThatThrownBy(() -> service.updateLiability(liabilityId, userId, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("name/type/principal/outstanding are always overwritten; optional fields only when present")
        void overwritesCoreFieldsUnconditionally() {
            Liability liability = Liability.builder().userId(userId).lenderName("Old Bank").build();
            ReflectionTestUtils.setField(liability, "id", liabilityId);
            when(liabilityRepository.findById(liabilityId)).thenReturn(Optional.of(liability));
            when(liabilityRepository.save(any(Liability.class))).thenAnswer(inv -> inv.getArgument(0));
            CreateLiabilityRequest req = request(new BigDecimal("200000"), new BigDecimal("150000"));
            when(req.getLenderName()).thenReturn(null); // omitted -> should NOT clear the existing value

            service.updateLiability(liabilityId, userId, req);

            assertThat(liability.getPrincipalAmount()).isEqualByComparingTo("200000");
            assertThat(liability.getOutstandingAmount()).isEqualByComparingTo("150000");
            assertThat(liability.getLenderName()).isEqualTo("Old Bank"); // preserved
        }
    }

    // ─── deleteLiability ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteLiability soft-deletes (active=false) rather than removing the row")
    void deleteLiabilitySoftDeletes() {
        Liability liability = Liability.builder().userId(userId).active(true).build();
        ReflectionTestUtils.setField(liability, "id", liabilityId);
        when(liabilityRepository.findById(liabilityId)).thenReturn(Optional.of(liability));

        service.deleteLiability(liabilityId, userId);

        assertThat(liability.isActive()).isFalse();
        verify(liabilityRepository).save(liability);
        verify(liabilityRepository, never()).delete(any());
    }

    // ─── getLiabilities (manual + derived from accounts) ────────────────────────

    @Nested
    @DisplayName("getLiabilities (manual records + derived loan/credit-card entries)")
    class GetLiabilitiesTests {

        @Test
        @DisplayName("a LOAN account always appears as a derived liability, balance floored at zero")
        void loanAccountAlwaysDerived() {
            when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
            AccountResponse loanAccount = AccountResponse.builder().id(UUID.randomUUID()).name("Car Loan")
                    .accountType("LOAN").currentBalance(new BigDecimal("-500")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(loanAccount));

            List<LiabilityResponse> result = service.getLiabilities(userId, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getOutstandingAmount()).isEqualByComparingTo("0"); // floored
            assertThat(result.get(0).isDerived()).isTrue();
        }

        @Test
        @DisplayName("a CREDIT_CARD account is only shown as a derived liability when it has a positive outstanding balance")
        void creditCardOnlyDerivedWhenPositiveBalance() {
            when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
            AccountResponse paidOffCard = AccountResponse.builder().id(UUID.randomUUID()).name("Paid Off Card")
                    .accountType("CREDIT_CARD").currentBalance(BigDecimal.ZERO).build();
            AccountResponse owedCard = AccountResponse.builder().id(UUID.randomUUID()).name("Owed Card")
                    .accountType("CREDIT_CARD").currentBalance(new BigDecimal("500")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(paidOffCard, owedCard));

            List<LiabilityResponse> result = service.getLiabilities(userId, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getName()).isEqualTo("Owed Card");
        }

        @Test
        @DisplayName("BANK_ACCOUNT and other non-liability account types never produce a derived entry")
        void nonLiabilityAccountTypesIgnored() {
            when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
            AccountResponse bank = AccountResponse.builder().id(UUID.randomUUID()).name("Savings")
                    .accountType("BANK_ACCOUNT").currentBalance(new BigDecimal("10000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(bank));

            List<LiabilityResponse> result = service.getLiabilities(userId, null);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("combines manually-entered liabilities with derived account-based ones in one list")
        void combinesManualAndDerived() {
            LiabilityResponse manual = LiabilityResponse.builder().id(UUID.randomUUID()).name("Personal Loan").build();
            when(liabilityMapper.toResponseList(any())).thenReturn(List.of(manual));
            when(liabilityRepository.findByUserIdAndActiveTrueOrderByCreatedAtDesc(userId)).thenReturn(List.of());
            AccountResponse loanAccount = AccountResponse.builder().id(UUID.randomUUID()).name("Car Loan")
                    .accountType("LOAN").currentBalance(new BigDecimal("5000")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(loanAccount));

            List<LiabilityResponse> result = service.getLiabilities(userId, null);

            assertThat(result).extracting(LiabilityResponse::getName).containsExactlyInAnyOrder("Personal Loan", "Car Loan");
        }
    }

    // ─── getTotalOutstanding ─────────────────────────────────────────────────────

    @Test
    @DisplayName("getTotalOutstanding delegates to the repository sum")
    void getTotalOutstandingDelegates() {
        when(liabilityRepository.sumOutstandingByUser(userId)).thenReturn(new BigDecimal("75000"));
        assertThat(service.getTotalOutstanding(userId, null)).isEqualByComparingTo("75000");
    }
}
