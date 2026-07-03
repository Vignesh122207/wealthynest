package com.wealthynest.domain.investment.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.request.LogIncomeRequest;
import com.wealthynest.domain.investment.dto.response.*;
import com.wealthynest.domain.investment.service.InvestmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/investments")
@RequiredArgsConstructor
public class InvestmentController {

    private final InvestmentService investmentService;

    // ── Core CRUD ─────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<InvestmentResponse>> create(
            @Valid @RequestBody CreateInvestmentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
            investmentService.createInvestment(SecurityUtils.requireCurrentUserId(), req)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<InvestmentResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.getInvestments(SecurityUtils.requireCurrentUserId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<InvestmentResponse>> update(
            @PathVariable UUID id, @Valid @RequestBody CreateInvestmentRequest req) {
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.updateInvestment(id, SecurityUtils.requireCurrentUserId(), req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        investmentService.deleteInvestment(id, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    // ── Search ────────────────────────────────────────────────────────────────

    @GetMapping("/search/stocks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<InvestmentSearchResult>>> searchStocks(
            @RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.success(investmentService.searchStocks(q)));
    }

    @GetMapping("/search/mf")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<InvestmentSearchResult>>> searchMF(
            @RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.success(investmentService.searchMF(q)));
    }

    @GetMapping("/gold-price")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<java.util.Map<String, java.math.BigDecimal>>> goldPrice() {
        return ResponseEntity.ok(ApiResponse.success(investmentService.getGoldPriceAllKarats()));
    }

    @GetMapping("/gold-price-info")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> goldPriceInfo() {
        return ResponseEntity.ok(ApiResponse.success(investmentService.getGoldPriceInfo()));
    }

    // ── Phase 2: Dividend suggestions ─────────────────────────────────────────

    @GetMapping("/dividend-suggestions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<DividendSuggestionResponse>>> dividendSuggestions() {
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.getDividendSuggestions(SecurityUtils.requireCurrentUserId())));
    }

    // ── Phase 3: SIP transactions ─────────────────────────────────────────────

    @PostMapping("/{id}/sip")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<SipTransactionResponse>> addSip(
            @PathVariable UUID id, @Valid @RequestBody CreateSipTransactionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
            investmentService.addSipTransaction(id, SecurityUtils.requireCurrentUserId(), req)));
    }

    @GetMapping("/{id}/sip")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<SipTransactionResponse>>> getSip(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.getSipTransactions(id, SecurityUtils.requireCurrentUserId())));
    }

    @DeleteMapping("/{id}/sip/{sipId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteSip(
            @PathVariable UUID id, @PathVariable Long sipId) {
        investmentService.deleteSipTransaction(sipId, SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/{id}/xirr")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Double>> getXirr(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.computeXirr(id, SecurityUtils.requireCurrentUserId())));
    }

    @PostMapping("/{id}/log-income")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> logIncome(
            @PathVariable UUID id, @Valid @RequestBody LogIncomeRequest req) {
        investmentService.logIncome(id, SecurityUtils.requireCurrentUserId(), req);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/income-history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<IncomeHistoryResponse>> getIncomeHistory(
            @RequestParam(defaultValue = "0") int year) {
        int targetYear = year > 0 ? year : java.time.LocalDate.now().getYear();
        return ResponseEntity.ok(ApiResponse.success(
            investmentService.getIncomeHistory(SecurityUtils.requireCurrentUserId(), targetYear)));
    }
}
