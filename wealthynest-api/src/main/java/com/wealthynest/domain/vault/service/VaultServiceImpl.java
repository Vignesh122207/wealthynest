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
import com.wealthynest.domain.vault.dto.response.VaultHealthItemSummary;
import com.wealthynest.domain.vault.dto.response.VaultHealthResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemResponse;
import com.wealthynest.domain.vault.dto.response.VaultItemSecretResponse;
import com.wealthynest.domain.vault.entity.VaultItem;
import com.wealthynest.domain.vault.mapper.VaultItemMapper;
import com.wealthynest.domain.vault.repository.VaultItemRepository;
import com.wealthynest.domain.vault.util.VaultPasswordStrengthEvaluator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.StringWriter;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Vault items are server-side encrypted (see {@link VaultEncryptionService}), so a valid JWT alone
 * is enough to list/edit metadata — but revealing the decrypted secret additionally requires
 * re-confirming the account password ("step-up" auth), so a leaked/stolen access token can't be
 * used alone to dump every stored password. Failed reveal attempts are rate-limited per user via
 * Redis, mirroring {@code TokenRevocationService}'s use of Redis for auth-adjacent state.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VaultServiceImpl implements VaultService {
    private static final int MAX_REVEAL_ATTEMPTS       = 5;
    private static final Duration REVEAL_LOCKOUT_PERIOD = Duration.ofMinutes(15);
    private static final Duration STEP_UP_TOKEN_TTL      = Duration.ofMinutes(5);

    private final VaultItemRepository   vaultItemRepository;
    private final VaultItemMapper       vaultItemMapper;
    private final VaultEncryptionService vaultEncryptionService;
    private final VaultSecretHasher     vaultSecretHasher;
    private final UserRepository        userRepository;
    private final PasswordEncoder       passwordEncoder;
    private final AuditService          auditService;
    private final StringRedisTemplate   redisTemplate;
    private final RestClient            hibpClient;

    @Override
    @Transactional
    public VaultItemResponse createItem(UUID userId, VaultItemRequest request) {
        if (request.getSecret() == null || request.getSecret().isBlank()) {
            throw new BusinessException("A password or note value is required.", HttpStatus.BAD_REQUEST);
        }
        VaultEncryptionService.EncryptedSecret encrypted = vaultEncryptionService.encrypt(request.getSecret());

        VaultItem item = VaultItem.builder()
                .userId(userId)
                .itemType(request.getItemType())
                .title(request.getTitle())
                .username(request.getUsername())
                .url(request.getUrl())
                .category(request.getCategory())
                .icon(request.getIcon())
                .secretCiphertext(encrypted.ciphertext())
                .secretIv(encrypted.iv())
                .keyVersion(encrypted.keyVersion())
                .build();
        applySecretHealth(item, request.getSecret());
        applyTotpSecret(item, request.getTotpSecret());
        item = vaultItemRepository.save(item);

        auditService.log(userId, "VAULT_ITEM_CREATED", "VAULT_ITEM", item.getId(), null, null, null, null);
        return vaultItemMapper.toResponse(item);
    }

    @Override
    @Transactional
    public VaultItemResponse updateItem(UUID itemId, UUID userId, VaultItemRequest request) {
        VaultItem item = findAndValidate(itemId, userId);
        // Bring any pre-existing fields left on an older key version up to current BEFORE applying
        // this call's own edits, so a call that only touches TOTP (leaving the password untouched)
        // can't end up with the two fields on different key versions under the shared key_version
        // column (see V40__vault_items.sql).
        normalizeKeyVersion(item);
        item.setItemType(request.getItemType());
        item.setTitle(request.getTitle());
        item.setUsername(request.getUsername());
        item.setUrl(request.getUrl());
        item.setCategory(request.getCategory());
        item.setIcon(request.getIcon());
        if (request.getSecret() != null && !request.getSecret().isBlank()) {
            VaultEncryptionService.EncryptedSecret encrypted = vaultEncryptionService.encrypt(request.getSecret());
            item.setSecretCiphertext(encrypted.ciphertext());
            item.setSecretIv(encrypted.iv());
            item.setKeyVersion(encrypted.keyVersion());
            applySecretHealth(item, request.getSecret());
        }
        applyTotpSecret(item, request.getTotpSecret());
        item = vaultItemRepository.save(item);

        auditService.log(userId, "VAULT_ITEM_UPDATED", "VAULT_ITEM", item.getId(), null, null, null, null);
        return vaultItemMapper.toResponse(item);
    }

    @Override
    @Transactional
    public void deleteItem(UUID itemId, UUID userId) {
        VaultItem item = findAndValidate(itemId, userId);
        vaultItemRepository.delete(item);
        auditService.log(userId, "VAULT_ITEM_DELETED", "VAULT_ITEM", itemId, null, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VaultItemResponse> getItems(UUID userId) {
        return vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId).stream()
                .map(vaultItemMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public VaultItemResponse getItem(UUID itemId, UUID userId) {
        return vaultItemMapper.toResponse(findAndValidate(itemId, userId));
    }

    @Override
    @Transactional
    public VaultItemResponse toggleFavorite(UUID itemId, UUID userId) {
        VaultItem item = findAndValidate(itemId, userId);
        item.setFavorite(!item.isFavorite());
        return vaultItemMapper.toResponse(vaultItemRepository.save(item));
    }

    @Override
    @Transactional
    public VaultItemSecretResponse revealSecret(UUID itemId, UUID userId, RevealVaultItemRequest request,
                                                 String ipAddress, String userAgent) {
        VaultItem item = findAndValidate(itemId, userId);
        requireStepUp("reveal", userId, request, ipAddress, userAgent);

        // Opportunistic self-healing migration: every reveal is already a write (lastRevealedAt),
        // so a row still on a retired key version gets upgraded to current here at no extra cost —
        // no separate rotation/migration job needed.
        normalizeKeyVersion(item);
        item.setLastRevealedAt(Instant.now());
        vaultItemRepository.save(item);

        auditService.log(userId, "VAULT_ITEM_REVEALED", "VAULT_ITEM", item.getId(), null, null, ipAddress, userAgent);
        return VaultItemSecretResponse.builder()
                .id(item.getId())
                .secret(vaultEncryptionService.decrypt(item.getSecretCiphertext(), item.getSecretIv(), item.getKeyVersion()))
                .totpSecret(item.getTotpCiphertext() == null ? null
                        : vaultEncryptionService.decrypt(item.getTotpCiphertext(), item.getTotpIv(), item.getKeyVersion()))
                .stepUpToken(issueStepUpToken(userId))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public String exportCsv(UUID userId, RevealVaultItemRequest request, String ipAddress, String userAgent) {
        requireStepUp("export", userId, request, ipAddress, userAgent);

        List<VaultItem> items = vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId);
        StringWriter writer = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                .setHeader("Title", "Type", "Username", "URL", "Category", "Password/Note", "TOTP Secret")
                .build())) {
            for (VaultItem item : items) {
                printer.printRecord(
                        item.getTitle(),
                        item.getItemType().name(),
                        item.getUsername(),
                        item.getUrl(),
                        item.getCategory(),
                        vaultEncryptionService.decrypt(item.getSecretCiphertext(), item.getSecretIv(), item.getKeyVersion()),
                        item.getTotpCiphertext() == null ? ""
                                : vaultEncryptionService.decrypt(item.getTotpCiphertext(), item.getTotpIv(), item.getKeyVersion()));
            }
        } catch (IOException e) {
            // StringWriter never throws IOException in practice — CSVPrinter's signature requires it.
            throw new IllegalStateException("Failed to build vault export CSV", e);
        }

        auditService.log(userId, "VAULT_EXPORTED", "USER", userId, null, null, ipAddress, userAgent);
        return writer.toString();
    }

    /** {@code null} totpSecret leaves any existing TOTP secret untouched; {@code ""} removes it;
     * a non-blank value encrypts and sets/replaces it — same convention as the main {@code secret}
     * field's create/update handling, extended with an explicit "remove" case. */
    private void applyTotpSecret(VaultItem item, String totpSecret) {
        if (totpSecret == null) return;
        if (totpSecret.isBlank()) {
            item.setTotpCiphertext(null);
            item.setTotpIv(null);
            return;
        }
        VaultEncryptionService.EncryptedSecret encrypted = vaultEncryptionService.encrypt(totpSecret);
        item.setTotpCiphertext(encrypted.ciphertext());
        item.setTotpIv(encrypted.iv());
    }

    @Override
    @Transactional(readOnly = true)
    public VaultHealthResponse getHealthSummary(UUID userId) {
        List<VaultItem> items = vaultItemRepository.findByUserIdOrderByFavoriteDescTitleAsc(userId);

        Map<String, Long> hashCounts = items.stream()
                .filter(i -> i.getSecretHash() != null)
                .collect(Collectors.groupingBy(VaultItem::getSecretHash, Collectors.counting()));

        List<VaultHealthItemSummary> reused = items.stream()
                .filter(i -> i.getSecretHash() != null && hashCounts.getOrDefault(i.getSecretHash(), 0L) > 1)
                .map(VaultServiceImpl::toHealthSummary).toList();
        List<VaultHealthItemSummary> weak = items.stream()
                .filter(i -> i.getStrengthLevel() != null && i.getStrengthLevel() <= 1)
                .map(VaultServiceImpl::toHealthSummary).toList();
        List<VaultHealthItemSummary> breached = items.stream()
                .filter(i -> i.getBreachCount() != null && i.getBreachCount() > 0)
                .map(VaultServiceImpl::toHealthSummary).toList();

        return VaultHealthResponse.builder()
                .totalItems(items.size())
                .reusedCount(reused.size()).reusedItems(reused)
                .weakCount(weak.size()).weakItems(weak)
                .breachedCount(breached.size()).breachedItems(breached)
                .build();
    }

    private static VaultHealthItemSummary toHealthSummary(VaultItem item) {
        return VaultHealthItemSummary.builder()
                .id(item.getId()).title(item.getTitle())
                .itemType(item.getItemType().name()).icon(item.getIcon())
                .build();
    }

    /** Computes and sets secret_hash/strength_level/breach_count on {@code item} from the
     * plaintext about to be encrypted. Breach checking fails open — never blocks the save. */
    private void applySecretHealth(VaultItem item, String plaintext) {
        item.setSecretHash(vaultSecretHasher.hash(plaintext));
        item.setStrengthLevel(VaultPasswordStrengthEvaluator.evaluate(plaintext));
        item.setBreachCount(checkBreach(plaintext));
    }

    /** Have I Been Pwned k-anonymity check: only a 5-char SHA-1 prefix leaves the server.
     * Returns null (unknown) on any failure — the caller must treat that as "not checked",
     * never as "clean". */
    private Integer checkBreach(String plaintext) {
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] digest = sha1.digest(plaintext.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02X", b));
            String full = hex.toString();
            String prefix = full.substring(0, 5);
            String suffix = full.substring(5);

            String body = hibpClient.get().uri("/range/{prefix}", prefix).retrieve().body(String.class);
            if (body == null) return null;
            for (String line : body.split("\r?\n")) {
                int colon = line.indexOf(':');
                if (colon < 0) continue;
                if (line.substring(0, colon).equalsIgnoreCase(suffix)) {
                    return Integer.parseInt(line.substring(colon + 1).trim());
                }
            }
            return 0;
        } catch (NoSuchAlgorithmException e) {
            // SHA-1 is a JDK-guaranteed algorithm; this can't actually happen.
            throw new IllegalStateException(e);
        } catch (Exception e) {
            log.warn("HIBP breach check unavailable, leaving breach status unknown: {}", e.getMessage());
            return null;
        }
    }

    /** Re-encrypts both encrypted fields on {@code item} under the current key version if either
     * is left on a retired one, keeping the shared {@code key_version} column (see
     * V40__vault_items.sql) truthful for both fields at once. No-op — and no decrypt call at all —
     * on the common path where nothing has ever been rotated. Caller is responsible for persisting. */
    private void normalizeKeyVersion(VaultItem item) {
        if (item.getKeyVersion() == vaultEncryptionService.currentKeyVersion()) return;
        int staleVersion = item.getKeyVersion();
        String secret = vaultEncryptionService.decrypt(item.getSecretCiphertext(), item.getSecretIv(), staleVersion);
        VaultEncryptionService.EncryptedSecret secretEncrypted = vaultEncryptionService.encrypt(secret);
        item.setSecretCiphertext(secretEncrypted.ciphertext());
        item.setSecretIv(secretEncrypted.iv());
        if (item.getTotpCiphertext() != null) {
            String totp = vaultEncryptionService.decrypt(item.getTotpCiphertext(), item.getTotpIv(), staleVersion);
            VaultEncryptionService.EncryptedSecret totpEncrypted = vaultEncryptionService.encrypt(totp);
            item.setTotpCiphertext(totpEncrypted.ciphertext());
            item.setTotpIv(totpEncrypted.iv());
        }
        item.setKeyVersion(secretEncrypted.keyVersion());
    }

    private VaultItem findAndValidate(UUID itemId, UUID userId) {
        VaultItem item = vaultItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("VaultItem", "id", itemId));
        if (!item.getUserId().equals(userId)) throw new AccessDeniedException();
        return item;
    }

    /** {@code scope} is "reveal" or "export" — kept as separate Redis counters/audit actions so a
     * user locked out of one isn't locked out of the other. */
    private static String lockoutKey(String scope, UUID userId) { return "vault-" + scope + "-attempts:" + userId; }

    private boolean isLockedOut(String scope, UUID userId) {
        try {
            String raw = redisTemplate.opsForValue().get(lockoutKey(scope, userId));
            return raw != null && Integer.parseInt(raw) >= MAX_REVEAL_ATTEMPTS;
        } catch (Exception e) {
            log.warn("Vault {} lockout check failed for user {}, failing open: {}", scope, userId, e.getMessage());
            return false;
        }
    }

    private void registerFailedAttempt(String scope, UUID userId, String ipAddress, String userAgent) {
        try {
            String key = lockoutKey(scope, userId);
            Long attempts = redisTemplate.opsForValue().increment(key);
            if (attempts != null && attempts == 1L) {
                redisTemplate.expire(key, REVEAL_LOCKOUT_PERIOD);
            }
            if (attempts != null && attempts >= MAX_REVEAL_ATTEMPTS) {
                log.warn("Vault {} locked after {} failed attempts for user {}", scope, MAX_REVEAL_ATTEMPTS, userId);
                auditService.log(userId, "VAULT_" + scope.toUpperCase() + "_LOCKED", "USER", userId, null, null, ipAddress, userAgent);
            }
        } catch (Exception e) {
            log.warn("Failed to record vault {} attempt for user {}: {}", scope, userId, e.getMessage());
        }
        auditService.log(userId, "VAULT_" + scope.toUpperCase() + "_FAILED", "USER", userId, null, null, ipAddress, userAgent);
    }

    private void clearFailedAttempts(String scope, UUID userId) {
        try {
            redisTemplate.delete(lockoutKey(scope, userId));
        } catch (Exception e) {
            log.warn("Failed to clear vault {} attempts for user {}: {}", scope, userId, e.getMessage());
        }
    }

    /** Authenticates a step-up action (reveal/export): a valid, unexpired {@code stepUpToken}
     * (opt-in "trust this device", issued by a prior successful reveal) short-circuits straight
     * through without touching the password or lockout state at all; otherwise falls back to the
     * normal password re-confirmation, rate-limited under its own {@code scope} counter. */
    private void requireStepUp(String scope, UUID userId, RevealVaultItemRequest request,
                                String ipAddress, String userAgent) {
        String token = request.getStepUpToken();
        if (token != null && !token.isBlank() && isValidStepUpToken(userId, token)) {
            return;
        }
        String currentPassword = request.getCurrentPassword();
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new BusinessException("Account password is required.", HttpStatus.BAD_REQUEST);
        }
        requireStepUpPassword(scope, userId, currentPassword, ipAddress, userAgent);
    }

    /** Confirms the caller's account password, applying the same Redis-backed rate limit as
     * {@code revealSecret} but under its own {@code scope} counter. Throws on lockout or a wrong
     * password; returns normally (and clears the counter) once verified. */
    private void requireStepUpPassword(String scope, UUID userId, String currentPassword,
                                        String ipAddress, String userAgent) {
        if (isLockedOut(scope, userId)) {
            throw new BusinessException(
                    "Too many incorrect password attempts. Please try again in 15 minutes.", HttpStatus.LOCKED);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        if (user.getPasswordHash() == null) {
            throw new BusinessException(
                    "Password confirmation isn't available for this account — set a password in Settings first.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            registerFailedAttempt(scope, userId, ipAddress, userAgent);
            throw new BusinessException("Incorrect password", HttpStatus.UNAUTHORIZED);
        }
        clearFailedAttempts(scope, userId);
    }

    private static String stepUpTokenKey(UUID userId) { return "vault-stepup:" + userId; }

    private boolean isValidStepUpToken(UUID userId, String token) {
        try {
            String stored = redisTemplate.opsForValue().get(stepUpTokenKey(userId));
            // Constant-time compare — this is a bearer secret, so guard against a timing side
            // channel even though the token's 122 bits of entropy make it infeasible in practice.
            return stored != null && MessageDigest.isEqual(
                    stored.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("Vault step-up token check failed for user {}, falling back to password: {}", userId, e.getMessage());
            return false;
        }
    }

    /** Issues (or refreshes) an opaque trust token the client may use in place of the password for
     * subsequent reveal/export calls within {@link #STEP_UP_TOKEN_TTL}. Best-effort: if Redis is
     * unavailable, callers just fall back to always requiring the password again. */
    private String issueStepUpToken(UUID userId) {
        String token = UUID.randomUUID().toString();
        try {
            redisTemplate.opsForValue().set(stepUpTokenKey(userId), token, STEP_UP_TOKEN_TTL);
        } catch (Exception e) {
            log.warn("Failed to issue vault step-up token for user {}: {}", userId, e.getMessage());
        }
        return token;
    }
}
