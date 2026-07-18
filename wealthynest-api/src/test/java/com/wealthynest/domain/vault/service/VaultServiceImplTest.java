package com.wealthynest.domain.vault.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.security.VaultEncryptionService;
import com.wealthynest.common.security.VaultSecretHasher;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.domain.vault.dto.request.RevealVaultItemRequest;
import com.wealthynest.domain.vault.dto.request.VaultItemRequest;
import com.wealthynest.domain.vault.dto.response.VaultHealthResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemSecretResponse;
import com.wealthynest.domain.vault.entity.VaultItem;
import com.wealthynest.domain.vault.entity.VaultItemType;
import com.wealthynest.domain.vault.mapper.VaultItemMapper;
import com.wealthynest.domain.vault.repository.VaultItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VaultServiceImplTest {

    @Mock private VaultItemRepository    vaultItemRepository;
    @Mock private VaultItemMapper        vaultItemMapper;
    @Mock private VaultEncryptionService vaultEncryptionService;
    @Mock private VaultSecretHasher      vaultSecretHasher;
    @Mock private UserRepository         userRepository;
    @Mock private PasswordEncoder        passwordEncoder;
    @Mock private AuditService           auditService;
    @Mock private StringRedisTemplate    redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    private RestClient hibpClient;

    private VaultServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final UUID itemId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Deep-stubbed so unstubbed fluent chains (get().uri(...).retrieve().body(...)) resolve to
        // null rather than NPE-ing — createItem/updateItem tests don't care about the breach check,
        // and VaultServiceImpl's checkBreach() is fail-open by design (catches and returns null).
        hibpClient = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        service = new VaultServiceImpl(vaultItemRepository, vaultItemMapper, vaultEncryptionService,
                vaultSecretHasher, userRepository, passwordEncoder, auditService, redisTemplate, hibpClient);
        lenient().when(vaultItemMapper.toResponse(any(VaultItem.class))).thenAnswer(inv -> {
            VaultItem item = inv.getArgument(0);
            return VaultItemResponse.builder().id(item.getId()).title(item.getTitle()).favorite(item.isFavorite()).build();
        });
    }

    private VaultItem withId(VaultItem item) {
        ReflectionTestUtils.setField(item, "id", itemId);
        return item;
    }

    private VaultItemRequest request(String secret) {
        VaultItemRequest req = new VaultItemRequest();
        ReflectionTestUtils.setField(req, "itemType", VaultItemType.LOGIN);
        ReflectionTestUtils.setField(req, "title", "GitHub");
        ReflectionTestUtils.setField(req, "secret", secret);
        ReflectionTestUtils.setField(req, "icon", "KeyRound");
        return req;
    }

    // ─── createItem ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("createItem throws when secret is blank")
    void createItemThrowsWhenSecretBlank() {
        assertThatThrownBy(() -> service.createItem(userId, request("")))
                .isInstanceOf(BusinessException.class);
        verifyNoInteractions(vaultItemRepository, vaultEncryptionService);
    }

    @Test
    @DisplayName("createItem encrypts the secret and saves with the caller's userId")
    void createItemEncryptsAndSaves() {
        when(vaultEncryptionService.encrypt("s3cret")).thenReturn(new VaultEncryptionService.EncryptedSecret("ct", "iv"));
        when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

        service.createItem(userId, request("s3cret"));

        ArgumentCaptor<VaultItem> captor = ArgumentCaptor.forClass(VaultItem.class);
        verify(vaultItemRepository).save(captor.capture());
        assertThat(captor.getValue().getUserId()).isEqualTo(userId);
        assertThat(captor.getValue().getSecretCiphertext()).isEqualTo("ct");
        assertThat(captor.getValue().getSecretIv()).isEqualTo("iv");
        assertThat(captor.getValue().getIcon()).isEqualTo("KeyRound");
        verify(auditService).log(eq(userId), eq("VAULT_ITEM_CREATED"), eq("VAULT_ITEM"), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("createItem persists the keyed secret hash and a computed strength level for Vault Health")
    void createItemComputesHealthFields() {
        when(vaultEncryptionService.encrypt(anyString())).thenReturn(new VaultEncryptionService.EncryptedSecret("ct", "iv"));
        when(vaultSecretHasher.hash("s3cret")).thenReturn("deadbeef");
        when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

        service.createItem(userId, request("s3cret"));

        ArgumentCaptor<VaultItem> captor = ArgumentCaptor.forClass(VaultItem.class);
        verify(vaultItemRepository).save(captor.capture());
        assertThat(captor.getValue().getSecretHash()).isEqualTo("deadbeef");
        assertThat(captor.getValue().getStrengthLevel()).isNotNull();
    }

    @Test
    @DisplayName("createItem still saves when the HIBP breach check is unreachable, leaving breachCount null")
    void createItemFailsOpenWhenBreachCheckUnreachable() {
        when(vaultEncryptionService.encrypt(anyString())).thenReturn(new VaultEncryptionService.EncryptedSecret("ct", "iv"));
        when(hibpClient.get().uri(anyString(), any(Object[].class)).retrieve().body(String.class))
                .thenThrow(new RuntimeException("connection refused"));
        when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

        service.createItem(userId, request("s3cret"));

        ArgumentCaptor<VaultItem> captor = ArgumentCaptor.forClass(VaultItem.class);
        verify(vaultItemRepository).save(captor.capture());
        assertThat(captor.getValue().getBreachCount()).isNull();
    }

    // ─── updateItem ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateItem")
    class UpdateItemTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the item doesn't exist")
        void throwsWhenNotFound() {
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.updateItem(itemId, userId, request(null)))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's item")
        void throwsWhenNotOwned() {
            VaultItem item = withId(VaultItem.builder().userId(UUID.randomUUID()).build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            assertThatThrownBy(() -> service.updateItem(itemId, userId, request(null)))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("leaves the existing secret untouched when the request's secret is blank")
        void blankSecretKeepsExisting() {
            VaultItem item = withId(VaultItem.builder().userId(userId)
                    .secretCiphertext("old-ct").secretIv("old-iv").build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            service.updateItem(itemId, userId, request(""));

            assertThat(item.getSecretCiphertext()).isEqualTo("old-ct");
            assertThat(item.getSecretIv()).isEqualTo("old-iv");
            verifyNoInteractions(vaultEncryptionService);
        }

        @Test
        @DisplayName("re-encrypts when the request supplies a new secret")
        void nonBlankSecretReEncrypts() {
            VaultItem item = withId(VaultItem.builder().userId(userId)
                    .secretCiphertext("old-ct").secretIv("old-iv").build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));
            when(vaultEncryptionService.encrypt("new-secret")).thenReturn(new VaultEncryptionService.EncryptedSecret("new-ct", "new-iv"));

            service.updateItem(itemId, userId, request("new-secret"));

            assertThat(item.getSecretCiphertext()).isEqualTo("new-ct");
            assertThat(item.getSecretIv()).isEqualTo("new-iv");
        }

        @Test
        @DisplayName("a null totpSecret leaves an existing TOTP secret untouched")
        void nullTotpSecretLeavesExistingUntouched() {
            VaultItem item = withId(VaultItem.builder().userId(userId)
                    .secretCiphertext("ct").secretIv("iv").totpCiphertext("totp-ct").totpIv("totp-iv").build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            service.updateItem(itemId, userId, request(null));

            assertThat(item.getTotpCiphertext()).isEqualTo("totp-ct");
        }

        @Test
        @DisplayName("an empty-string totpSecret removes an existing TOTP secret")
        void emptyTotpSecretRemovesExisting() {
            VaultItem item = withId(VaultItem.builder().userId(userId)
                    .secretCiphertext("ct").secretIv("iv").totpCiphertext("totp-ct").totpIv("totp-iv").build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            VaultItemRequest req = request(null);
            ReflectionTestUtils.setField(req, "totpSecret", "");
            service.updateItem(itemId, userId, req);

            assertThat(item.getTotpCiphertext()).isNull();
            assertThat(item.getTotpIv()).isNull();
        }

        @Test
        @DisplayName("a non-blank totpSecret encrypts and sets a new TOTP secret")
        void nonBlankTotpSecretEncryptsAndSets() {
            VaultItem item = withId(VaultItem.builder().userId(userId).secretCiphertext("ct").secretIv("iv").build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));
            when(vaultEncryptionService.encrypt("JBSWY3DPEHPK3PXP"))
                    .thenReturn(new VaultEncryptionService.EncryptedSecret("totp-ct", "totp-iv"));

            VaultItemRequest req = request(null);
            ReflectionTestUtils.setField(req, "totpSecret", "JBSWY3DPEHPK3PXP");
            service.updateItem(itemId, userId, req);

            assertThat(item.getTotpCiphertext()).isEqualTo("totp-ct");
            assertThat(item.getTotpIv()).isEqualTo("totp-iv");
        }
    }

    // ─── deleteItem ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("deleteItem throws AccessDeniedException for another user's item and never deletes")
    void deleteItemThrowsWhenNotOwned() {
        VaultItem item = withId(VaultItem.builder().userId(UUID.randomUUID()).build());
        when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> service.deleteItem(itemId, userId)).isInstanceOf(AccessDeniedException.class);
        verify(vaultItemRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteItem removes the item when owned")
    void deleteItemRemovesWhenOwned() {
        VaultItem item = withId(VaultItem.builder().userId(userId).build());
        when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));

        service.deleteItem(itemId, userId);

        verify(vaultItemRepository).delete(item);
    }

    // ─── toggleFavorite ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("toggleFavorite flips the favorite flag")
    void toggleFavoriteFlips() {
        VaultItem item = withId(VaultItem.builder().userId(userId).favorite(false).build());
        when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
        when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

        VaultItemResponse response = service.toggleFavorite(itemId, userId);

        assertThat(item.isFavorite()).isTrue();
        assertThat(response.isFavorite()).isTrue();
    }

    // ─── revealSecret ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("revealSecret")
    class RevealSecretTests {

        private VaultItem item;
        private User user;

        @BeforeEach
        void seed() {
            item = withId(VaultItem.builder().userId(userId).secretCiphertext("ct").secretIv("iv").build());
            user = User.builder().passwordHash("hashed-pw").build();
            lenient().when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(item));
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        }

        private RevealVaultItemRequest revealRequest(String password) {
            RevealVaultItemRequest req = new RevealVaultItemRequest();
            ReflectionTestUtils.setField(req, "currentPassword", password);
            return req;
        }

        @Test
        @DisplayName("returns the decrypted secret and clears the failed-attempt counter on correct password")
        void returnsDecryptedSecretOnSuccess() {
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("correct", "hashed-pw")).thenReturn(true);
            when(vaultEncryptionService.decrypt("ct", "iv")).thenReturn("plaintext-secret");
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            VaultItemSecretResponse response = service.revealSecret(itemId, userId, revealRequest("correct"), "1.2.3.4", "ua");

            assertThat(response.getSecret()).isEqualTo("plaintext-secret");
            assertThat(response.getTotpSecret()).isNull();
            assertThat(item.getLastRevealedAt()).isNotNull();
            verify(redisTemplate).delete(anyString());
            verify(auditService).log(eq(userId), eq("VAULT_ITEM_REVEALED"), eq("VAULT_ITEM"), any(), any(), any(), eq("1.2.3.4"), eq("ua"));
        }

        @Test
        @DisplayName("throws when neither currentPassword nor a valid stepUpToken is supplied")
        void throwsWhenNeitherPasswordNorTokenSupplied() {
            assertThatThrownBy(() -> service.revealSecret(itemId, userId, revealRequest(""), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Account password is required");
            verifyNoInteractions(userRepository, passwordEncoder);
        }

        @Test
        @DisplayName("a valid stepUpToken skips the password check entirely")
        void validStepUpTokenSkipsPasswordCheck() {
            RevealVaultItemRequest req = new RevealVaultItemRequest();
            ReflectionTestUtils.setField(req, "stepUpToken", "trusted-token");
            when(valueOperations.get("vault-stepup:" + userId)).thenReturn("trusted-token");
            when(vaultEncryptionService.decrypt("ct", "iv")).thenReturn("plaintext-secret");
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            VaultItemSecretResponse response = service.revealSecret(itemId, userId, req, "1.2.3.4", "ua");

            assertThat(response.getSecret()).isEqualTo("plaintext-secret");
            verifyNoInteractions(userRepository, passwordEncoder);
        }

        @Test
        @DisplayName("decrypts and includes the TOTP secret when the item has one")
        void includesDecryptedTotpSecretWhenPresent() {
            item.setTotpCiphertext("totp-ct");
            item.setTotpIv("totp-iv");
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("correct", "hashed-pw")).thenReturn(true);
            when(vaultEncryptionService.decrypt("ct", "iv")).thenReturn("plaintext-secret");
            when(vaultEncryptionService.decrypt("totp-ct", "totp-iv")).thenReturn("JBSWY3DPEHPK3PXP");
            when(vaultItemRepository.save(any(VaultItem.class))).thenAnswer(inv -> inv.getArgument(0));

            VaultItemSecretResponse response = service.revealSecret(itemId, userId, revealRequest("correct"), "1.2.3.4", "ua");

            assertThat(response.getTotpSecret()).isEqualTo("JBSWY3DPEHPK3PXP");
        }

        @Test
        @DisplayName("throws UNAUTHORIZED and increments the attempt counter on wrong password")
        void throwsAndIncrementsOnWrongPassword() {
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("wrong", "hashed-pw")).thenReturn(false);
            when(valueOperations.increment(anyString())).thenReturn(1L);

            assertThatThrownBy(() -> service.revealSecret(itemId, userId, revealRequest("wrong"), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Incorrect password");

            verify(valueOperations).increment(anyString());
            verifyNoInteractions(vaultEncryptionService);
        }

        @Test
        @DisplayName("locks out further attempts once the failed-attempt counter reaches the max, without checking the password")
        void locksOutAfterMaxAttempts() {
            when(valueOperations.get(anyString())).thenReturn("5");

            assertThatThrownBy(() -> service.revealSecret(itemId, userId, revealRequest("anything"), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Too many incorrect password attempts");

            verifyNoInteractions(passwordEncoder, userRepository);
        }

        @Test
        @DisplayName("throws when the account has no local password (e.g. Google-only sign-in)")
        void throwsWhenNoLocalPassword() {
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().passwordHash(null).build()));

            assertThatThrownBy(() -> service.revealSecret(itemId, userId, revealRequest("anything"), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class);
            verifyNoInteractions(vaultEncryptionService);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's item before touching password logic")
        void throwsWhenNotOwned() {
            VaultItem othersItem = withId(VaultItem.builder().userId(UUID.randomUUID()).build());
            when(vaultItemRepository.findById(itemId)).thenReturn(Optional.of(othersItem));

            assertThatThrownBy(() -> service.revealSecret(itemId, userId, revealRequest("anything"), "1.2.3.4", "ua"))
                    .isInstanceOf(AccessDeniedException.class);
            verifyNoInteractions(userRepository, passwordEncoder);
        }
    }

    // ─── exportCsv ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("exportCsv")
    class ExportCsvTests {

        private RevealVaultItemRequest exportRequest(String password) {
            RevealVaultItemRequest req = new RevealVaultItemRequest();
            ReflectionTestUtils.setField(req, "currentPassword", password);
            return req;
        }

        @Test
        @DisplayName("decrypts every item and writes a CSV row per item, gated by password confirmation")
        void writesCsvRowPerItem() {
            VaultItem item = VaultItem.builder().userId(userId).title("GitHub").itemType(VaultItemType.LOGIN)
                    .username("me@example.com").secretCiphertext("ct").secretIv("iv").build();
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().passwordHash("hashed-pw").build()));
            when(passwordEncoder.matches("correct", "hashed-pw")).thenReturn(true);
            when(vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId)).thenReturn(List.of(item));
            when(vaultEncryptionService.decrypt("ct", "iv")).thenReturn("s3cret");

            String csv = service.exportCsv(userId, exportRequest("correct"), "1.2.3.4", "ua");

            assertThat(csv).contains("GitHub").contains("me@example.com").contains("s3cret");
            verify(auditService).log(eq(userId), eq("VAULT_EXPORTED"), eq("USER"), eq(userId), any(), any(), eq("1.2.3.4"), eq("ua"));
        }

        @Test
        @DisplayName("throws on wrong password without touching any item's ciphertext")
        void throwsOnWrongPassword() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(anyString())).thenReturn(null);
            when(userRepository.findById(userId)).thenReturn(Optional.of(User.builder().passwordHash("hashed-pw").build()));
            when(passwordEncoder.matches("wrong", "hashed-pw")).thenReturn(false);

            assertThatThrownBy(() -> service.exportCsv(userId, exportRequest("wrong"), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Incorrect password");
            verifyNoInteractions(vaultEncryptionService);
        }

        @Test
        @DisplayName("export lockout is a separate counter from reveal lockout")
        void usesSeparateLockoutFromReveal() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get("vault-export-attempts:" + userId)).thenReturn("5");

            assertThatThrownBy(() -> service.exportCsv(userId, exportRequest("anything"), "1.2.3.4", "ua"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("Too many incorrect password attempts");

            // A maxed-out export counter must not be consulted by reveal's own lockout check.
            verify(valueOperations, never()).get("vault-reveal-attempts:" + userId);
        }
    }

    // ─── getHealthSummary ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getHealthSummary")
    class HealthSummaryTests {

        @Test
        @DisplayName("groups items sharing a secret hash as reused, flags low strength as weak, and positive breach count as breached")
        void aggregatesHealthCorrectly() {
            VaultItem reusedA = VaultItem.builder().userId(userId).title("Reused A").itemType(VaultItemType.LOGIN)
                    .secretHash("same-hash").strengthLevel(3).build();
            ReflectionTestUtils.setField(reusedA, "id", UUID.randomUUID());
            VaultItem reusedB = VaultItem.builder().userId(userId).title("Reused B").itemType(VaultItemType.LOGIN)
                    .secretHash("same-hash").strengthLevel(3).build();
            ReflectionTestUtils.setField(reusedB, "id", UUID.randomUUID());
            VaultItem weak = VaultItem.builder().userId(userId).title("Weak One").itemType(VaultItemType.LOGIN)
                    .secretHash("unique-hash").strengthLevel(0).build();
            ReflectionTestUtils.setField(weak, "id", UUID.randomUUID());
            VaultItem breached = VaultItem.builder().userId(userId).title("Breached One").itemType(VaultItemType.LOGIN)
                    .secretHash("another-hash").strengthLevel(4).breachCount(12).build();
            ReflectionTestUtils.setField(breached, "id", UUID.randomUUID());
            VaultItem clean = VaultItem.builder().userId(userId).title("Clean One").itemType(VaultItemType.SECURE_NOTE)
                    .secretHash("clean-hash").strengthLevel(4).breachCount(0).build();
            ReflectionTestUtils.setField(clean, "id", UUID.randomUUID());

            when(vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId))
                    .thenReturn(List.of(reusedA, reusedB, weak, breached, clean));

            VaultHealthResponse health = service.getHealthSummary(userId);

            assertThat(health.getTotalItems()).isEqualTo(5);
            assertThat(health.getReusedCount()).isEqualTo(2);
            assertThat(health.getReusedItems()).extracting("title").containsExactlyInAnyOrder("Reused A", "Reused B");
            assertThat(health.getWeakCount()).isEqualTo(1);
            assertThat(health.getWeakItems()).extracting("title").containsExactly("Weak One");
            assertThat(health.getBreachedCount()).isEqualTo(1);
            assertThat(health.getBreachedItems()).extracting("title").containsExactly("Breached One");
        }

        @Test
        @DisplayName("returns all-zero counts for a vault with no health issues")
        void allCleanVaultReportsZeroCounts() {
            VaultItem clean = VaultItem.builder().userId(userId).title("Clean").itemType(VaultItemType.LOGIN)
                    .secretHash("only-hash").strengthLevel(4).breachCount(0).build();
            when(vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId)).thenReturn(List.of(clean));

            VaultHealthResponse health = service.getHealthSummary(userId);

            assertThat(health.getReusedCount()).isZero();
            assertThat(health.getWeakCount()).isZero();
            assertThat(health.getBreachedCount()).isZero();
        }
    }
}
