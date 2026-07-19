package com.wealthynest.domain.account.service;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountOwnershipGuardTest {

    @Mock private WalletAccountRepository accountRepository;

    private AccountOwnershipGuard guard;

    @BeforeEach
    void setUp() {
        guard = new AccountOwnershipGuard(accountRepository);
    }

    private final UUID accountId = UUID.randomUUID();
    private final UUID userId    = UUID.randomUUID();

    @Test
    void doesNothingWhenAccountIdIsNull() {
        assertThatCode(() -> guard.validateAccountOwnership(null, userId)).doesNotThrowAnyException();
        verify(accountRepository, never()).findByIdAndUserId(any(), any());
    }

    @Test
    void passesWhenAccountBelongsToCaller() {
        WalletAccount account = WalletAccount.builder().userId(userId).accountType(AccountType.CASH_WALLET)
                .name("Wallet").openingBalance(BigDecimal.ZERO).build();
        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.of(account));

        assertThatCode(() -> guard.validateAccountOwnership(accountId, userId)).doesNotThrowAnyException();
    }

    @Test
    void throwsResourceNotFoundWhenAccountDoesNotBelongToCaller() {
        when(accountRepository.findByIdAndUserId(accountId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> guard.validateAccountOwnership(accountId, userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
