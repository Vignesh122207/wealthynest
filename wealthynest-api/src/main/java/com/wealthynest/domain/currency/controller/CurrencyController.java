package com.wealthynest.domain.currency.controller;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.domain.currency.dto.response.CurrencyRatesResponse;
import com.wealthynest.domain.currency.service.CurrencyRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/currency")
@RequiredArgsConstructor
public class CurrencyController {
    private final CurrencyRateService currencyRateService;

    @GetMapping("/rates")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<CurrencyRatesResponse>> getRates() {
        CurrencyRatesResponse rates = currencyRateService.getRates();
        if (rates == null) {
            throw new BusinessException("Currency rates are temporarily unavailable.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        return ResponseEntity.ok(ApiResponse.success(rates));
    }
}
