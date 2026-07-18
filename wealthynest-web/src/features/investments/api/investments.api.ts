import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {
    CreateInvestmentPayload,
    CreateSipPayload,
    CreateStockTransactionPayload,
    DividendSuggestion,
    IncomeHistory,
    Investment,
    InvestmentSearchResult,
    InvestmentType,
    SipTransaction,
    StockTransaction,
} from "../types/investment.types";

export const investmentsApi = {
  getInvestments:   async (): Promise<Investment[]> =>
    (await apiClient.get<ApiResponse<Investment[]>>("/investments")).data.data,

  createInvestment: async (p: CreateInvestmentPayload): Promise<Investment> =>
    (await apiClient.post<ApiResponse<Investment>>("/investments", p)).data.data,

  updateInvestment: async (id: string, p: CreateInvestmentPayload): Promise<Investment> =>
    (await apiClient.put<ApiResponse<Investment>>(`/investments/${id}`, p)).data.data,

  deleteInvestment: async (id: string): Promise<void> => {
    await apiClient.delete(`/investments/${id}`);
  },

  searchStocks: async (q: string): Promise<InvestmentSearchResult[]> =>
    (await apiClient.get<ApiResponse<InvestmentSearchResult[]>>("/investments/search/stocks", { params: { q } })).data.data,

  searchMF: async (q: string): Promise<InvestmentSearchResult[]> =>
    (await apiClient.get<ApiResponse<InvestmentSearchResult[]>>("/investments/search/mf", { params: { q } })).data.data,

  getGoldPrice: async (): Promise<{ price18k: number; price22k: number; price24k: number }> =>
    (await apiClient.get<ApiResponse<{ price18k: number; price22k: number; price24k: number }>>("/investments/gold-price")).data.data,

  getGoldPriceInfo: async (): Promise<{ price18k: number; price22k: number; price24k: number; lastUpdated?: string }> =>
    (await apiClient.get<ApiResponse<{ price18k: number; price22k: number; price24k: number; lastUpdated?: string }>>("/investments/gold-price-info")).data.data,

  // Phase 3 — SIP
  getSipTransactions: async (investmentId: string): Promise<SipTransaction[]> =>
    (await apiClient.get<ApiResponse<SipTransaction[]>>(`/investments/${investmentId}/sip`)).data.data ?? [],

  addSipTransaction: async ({ investmentId, data }: { investmentId: string; data: CreateSipPayload }): Promise<SipTransaction> =>
    (await apiClient.post<ApiResponse<SipTransaction>>(`/investments/${investmentId}/sip`, data)).data.data,

  deleteSipTransaction: async (investmentId: string, sipId: number): Promise<void> => {
    await apiClient.delete(`/investments/${investmentId}/sip/${sipId}`);
  },

  getXirr: async (investmentId: string): Promise<number | null> =>
    (await apiClient.get<ApiResponse<number | null>>(`/investments/${investmentId}/xirr`)).data.data,

  getPortfolioXirr: async (): Promise<number | null> =>
    (await apiClient.get<ApiResponse<number | null>>("/investments/portfolio-xirr")).data.data,

  getTypeXirr: async (type: InvestmentType): Promise<number | null> =>
    (await apiClient.get<ApiResponse<number | null>>("/investments/type-xirr", { params: { type } })).data.data,

  // Phase 2 — Dividend suggestions
  getDividendSuggestions: async (): Promise<DividendSuggestion[]> =>
    (await apiClient.get<ApiResponse<DividendSuggestion[]>>("/investments/dividend-suggestions")).data.data ?? [],

  // Income History
  getIncomeHistory: async (year?: number): Promise<IncomeHistory> =>
    (await apiClient.get<ApiResponse<IncomeHistory>>("/investments/income-history", { params: year ? { year } : {} })).data.data,

  // Manual income logging
  logIncome: async (investmentId: string, data: {
    incomeType: string; exDate: string; amount: number; perShare?: number; shares?: number;
  }): Promise<void> => {
    await apiClient.post(`/investments/${investmentId}/log-income`, data);
  },

  // Dismiss a dividend suggestion
  dismissDividend: async (investmentId: string, exDate: string): Promise<void> => {
    await apiClient.post(`/investments/${investmentId}/dismiss-dividend`, { exDate });
  },

  // Stock buy/sell transactions (buy-more, sell)
  getStockTransactions: async (investmentId: string): Promise<StockTransaction[]> =>
    (await apiClient.get<ApiResponse<StockTransaction[]>>(`/investments/${investmentId}/stock-transactions`)).data.data ?? [],

  addStockTransaction: async (investmentId: string, data: CreateStockTransactionPayload): Promise<StockTransaction> =>
    (await apiClient.post<ApiResponse<StockTransaction>>(`/investments/${investmentId}/stock-transactions`, data)).data.data,

  deleteStockTransaction: async (investmentId: string, txnId: number): Promise<void> => {
    await apiClient.delete(`/investments/${investmentId}/stock-transactions/${txnId}`);
  },
};
