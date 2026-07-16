package com.wealthynest.domain.account.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.account.dto.request.CreateAccountRequest;
import com.wealthynest.domain.account.dto.request.LoanPaymentRequest;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.dto.request.UpdateTransferRequest;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.dto.response.TransferResponse;
import com.wealthynest.domain.account.service.LoanPaymentService;
import com.wealthynest.domain.account.service.WalletAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
public class WalletAccountController {

    private final WalletAccountService accountService;
    private final LoanPaymentService   loanPaymentService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(accountService.getAccounts(SecurityUtils.requireCurrentUserId())));
    }

    @GetMapping("/archived")
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getArchived() {
        return ResponseEntity.ok(ApiResponse.success(accountService.getArchivedAccounts(SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AccountResponse>> create(@Valid @RequestBody CreateAccountRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(accountService.createAccount(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AccountResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody CreateAccountRequest request) {
        return ResponseEntity.ok(ApiResponse.success(accountService.updateAccount(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<ApiResponse<AccountResponse>> archive(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                accountService.archiveAccount(id, SecurityUtils.requireCurrentUserId())));
    }

    @PatchMapping("/{id}/unarchive")
    public ResponseEntity<ApiResponse<AccountResponse>> unarchive(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                accountService.unarchiveAccount(id, SecurityUtils.requireCurrentUserId())));
    }

    @PatchMapping("/{id}/set-primary")
    public ResponseEntity<ApiResponse<AccountResponse>> setPrimary(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                accountService.setPrimary(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
            @RequestParam(defaultValue = "false") boolean alsoDeleteTransactions) {
        accountService.deleteAccount(id, SecurityUtils.requireCurrentUserId(), alsoDeleteTransactions);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/transfers")
    public ResponseEntity<PagedResponse<TransferResponse>> getTransfers(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("transferDate").descending());
        return ResponseEntity.ok(accountService.getTransfers(SecurityUtils.requireCurrentUserId(), pageable));
    }

    @PostMapping("/transfer")
    public ResponseEntity<ApiResponse<TransferResponse>> transfer(@Valid @RequestBody TransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(accountService.transfer(SecurityUtils.requireCurrentUserId(), request)));
    }

    @PutMapping("/transfer/{id}")
    public ResponseEntity<ApiResponse<TransferResponse>> updateTransfer(
            @PathVariable UUID id, @Valid @RequestBody UpdateTransferRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                accountService.updateTransfer(id, SecurityUtils.requireCurrentUserId(), request)));
    }

    @DeleteMapping("/transfer/{id}")
    public ResponseEntity<Void> deleteTransfer(@PathVariable UUID id) {
        accountService.deleteTransfer(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    /** Records a loan payment (EMI or prepayment) — split into interest expense + principal transfer. */
    @PostMapping("/{id}/loan-payment")
    public ResponseEntity<ApiResponse<LoanPaymentService.AccountResult>> recordLoanPayment(
            @PathVariable UUID id, @Valid @RequestBody LoanPaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(loanPaymentService.recordPayment(
                id, SecurityUtils.requireCurrentUserId(), request.getAmount(), request.getFromAccountId())));
    }

    @PostMapping("/{id}/adjust-balance")
    public ResponseEntity<ApiResponse<AccountResponse>> adjustBalance(
            @PathVariable UUID id, @RequestBody Map<String, BigDecimal> body) {
        BigDecimal target = body.get("targetBalance");
        return ResponseEntity.ok(ApiResponse.success(
                accountService.adjustBalance(id, SecurityUtils.requireCurrentUserId(), target)));
    }

    @GetMapping("/{id}/statement")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> downloadStatement(@PathVariable UUID id) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        byte[] csv  = accountService.generateStatementCsv(id, userId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDisposition(
            ContentDisposition.attachment().filename("account-statement-" + id + ".csv").build());
        return ResponseEntity.ok().headers(headers).body(csv);
    }
}
