package com.wealthynest.domain.investment.service;

import com.wealthynest.domain.investment.dto.request.CreateInvestmentRequest;
import com.wealthynest.domain.investment.dto.request.CreateSipTransactionRequest;
import com.wealthynest.domain.investment.dto.request.LogIncomeRequest;
import com.wealthynest.domain.investment.dto.response.DividendSuggestionResponse;
import com.wealthynest.domain.investment.dto.response.IncomeHistoryResponse;
import com.wealthynest.domain.investment.dto.response.InvestmentResponse;
import com.wealthynest.domain.investment.dto.response.InvestmentSearchResult;
import com.wealthynest.domain.investment.dto.response.SipTransactionResponse;

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
    IncomeHistoryResponse getIncomeHistory(UUID userId, int year);

    // Manual income logging
    void logIncome(UUID investmentId, UUID userId, LogIncomeRequest req);
}
