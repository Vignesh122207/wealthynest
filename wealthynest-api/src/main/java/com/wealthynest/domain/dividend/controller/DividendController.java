package com.wealthynest.domain.dividend.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.dividend.dto.request.CreateBondInterestRequest;
import com.wealthynest.domain.dividend.dto.request.CreateDividendRequest;
import com.wealthynest.domain.dividend.dto.response.BondInterestResponse;
import com.wealthynest.domain.dividend.dto.response.DividendResponse;
import com.wealthynest.domain.dividend.service.DividendService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class DividendController {
    private final DividendService dividendService;

    @PostMapping("/dividends")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DividendResponse>> createDividend(
            @Valid @RequestBody CreateDividendRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                dividendService.createDividend(SecurityUtils.requireCurrentUserId(), request)));
    }

    @GetMapping("/dividends")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<DividendResponse>> getDividends(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(PagedResponse.of(dividendService.getDividends(
                SecurityUtils.requireCurrentUserId(),
                PageRequest.of(page, size, Sort.by("dividendDate").descending()))));
    }

    @PostMapping("/bond-interests")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<BondInterestResponse>> createBondInterest(
            @Valid @RequestBody CreateBondInterestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(
                dividendService.createBondInterest(SecurityUtils.requireCurrentUserId(), request)));
    }

    @GetMapping("/bond-interests")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PagedResponse<BondInterestResponse>> getBondInterests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(PagedResponse.of(dividendService.getBondInterests(
                SecurityUtils.requireCurrentUserId(),
                PageRequest.of(page, size, Sort.by("interestDate").descending()))));
    }
}
