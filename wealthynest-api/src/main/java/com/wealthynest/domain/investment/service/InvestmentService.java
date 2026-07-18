package com.wealthynest.domain.investment.service;

import com.wealthynest.domain.investment.dto.request.*;
import com.wealthynest.domain.investment.dto.response.*;
import com.wealthynest.domain.investment.entity.InvestmentType;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface InvestmentService {
    InvestmentResponse createInvestment(UUID userId, CreateInvestmentRequest request);
    InvestmentResponse updateInvestment(UUID investmentId, UUID userId, CreateInvestmentRequest request);
    void deleteInvestment(UUID investmentId, UUID userId);
    List<InvestmentResponse> getInvestments(UUID userId);
    List<InvestmentSearchResult> searchStocks(String query);
    List<InvestmentSearchResult> searchMF(String query);
    BigDecimal getGoldPrice22k();
    java.util.Map<String, BigDecimal> getGoldPriceAllKarats();
    java.util.Map<String, Object> getGoldPriceInfo();

    // Phase 2: Dividend suggestions
    List<DividendSuggestionResponse> getDividendSuggestions(UUID userId);

    // Phase 3: SIP
    SipTransactionResponse addSipTransaction(UUID investmentId, UUID userId, CreateSipTransactionRequest req);
    List<SipTransactionResponse> getSipTransactions(UUID investmentId, UUID userId);
    void deleteSipTransaction(Long sipId, UUID userId);
    Double computeXirr(UUID investmentId, UUID userId);
    Double computePortfolioXirr(UUID userId);
    Double computeTypeXirr(UUID userId, InvestmentType type);
    IncomeHistoryResponse getIncomeHistory(UUID userId, int year);

    // Manual income logging
    void logIncome(UUID investmentId, UUID userId, LogIncomeRequest req);

    // Dismiss a dividend suggestion (issue #3)
    void dismissDividend(UUID investmentId, UUID userId, DismissDividendRequest req);

    // Stock buy-more / sell transactions (issues #6, #7)
    StockTransactionResponse addStockTransaction(UUID investmentId, UUID userId, CreateStockTransactionRequest req);
    List<StockTransactionResponse> getStockTransactions(UUID investmentId, UUID userId);
    void deleteStockTransaction(UUID investmentId, Long txnId, UUID userId);
}
