package com.wealthynest.domain.currency.service;

import com.wealthynest.domain.currency.dto.response.CurrencyRatesResponse;

public interface CurrencyRateService {
    /** Live INR→USD/EUR conversion rates, cached — see CurrencyRateServiceImpl for TTL/fallback. */
    CurrencyRatesResponse getRates();
}
