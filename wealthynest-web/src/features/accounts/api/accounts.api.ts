import {apiClient} from "@/lib/axios";
import type {ApiResponse, PagedResponse} from "@/types/api.types";
import type {
  AccountTransfer,
  CreateAccountPayload,
  LoanPaymentResult,
  TransferPayload,
  WalletAccount
} from "../types/account.types";

export const accountsApi = {
  getAccounts: async (): Promise<WalletAccount[]> =>
    (await apiClient.get<ApiResponse<WalletAccount[]>>("/accounts")).data.data,

  createAccount: async (p: CreateAccountPayload): Promise<WalletAccount> =>
    (await apiClient.post<ApiResponse<WalletAccount>>("/accounts", p)).data.data,

  updateAccount: async (id: string, p: Partial<CreateAccountPayload>): Promise<WalletAccount> =>
    (await apiClient.put<ApiResponse<WalletAccount>>(`/accounts/${id}`, p)).data.data,

  getArchivedAccounts: async (): Promise<WalletAccount[]> =>
    (await apiClient.get<ApiResponse<WalletAccount[]>>("/accounts/archived")).data.data,

  archiveAccount: async (id: string): Promise<WalletAccount> =>
    (await apiClient.patch<ApiResponse<WalletAccount>>(`/accounts/${id}/archive`)).data.data,

  unarchiveAccount: async (id: string): Promise<WalletAccount> =>
    (await apiClient.patch<ApiResponse<WalletAccount>>(`/accounts/${id}/unarchive`)).data.data,

  /** ACTIVE → CLOSED only — a real-world terminal event (loan paid off, account closed at the
   * bank). Not reversible in this version, unlike archive. */
  closeAccount: async (id: string): Promise<WalletAccount> =>
    (await apiClient.patch<ApiResponse<WalletAccount>>(`/accounts/${id}/close`)).data.data,

  setPrimary: async (id: string): Promise<WalletAccount> =>
    (await apiClient.patch<ApiResponse<WalletAccount>>(`/accounts/${id}/set-primary`)).data.data,

  /** Only succeeds when the account has zero history — the API rejects (409) otherwise with a
   * message suggesting Close or Archive instead. */
  deleteAccount: async (id: string): Promise<void> => {
    await apiClient.delete(`/accounts/${id}`);
  },

  getTransfers: async (page = 0, size = 20): Promise<PagedResponse<AccountTransfer>> =>
    (await apiClient.get<PagedResponse<AccountTransfer>>(`/accounts/transfers?page=${page}&size=${size}`)).data,

  transfer: async (p: TransferPayload): Promise<AccountTransfer> =>
    (await apiClient.post<ApiResponse<AccountTransfer>>("/accounts/transfer", p)).data.data,

  updateTransfer: async (id: string, p: { amount?: number; transferDate?: string; description?: string }): Promise<AccountTransfer> =>
    (await apiClient.put<ApiResponse<AccountTransfer>>(`/accounts/transfer/${id}`, p)).data.data,

  deleteTransfer: async (id: string): Promise<void> => { await apiClient.delete(`/accounts/transfer/${id}`); },

  adjustBalance: async (id: string, targetBalance: number): Promise<WalletAccount> =>
    (await apiClient.post<ApiResponse<WalletAccount>>(`/accounts/${id}/adjust-balance`, { targetBalance })).data.data,

  /** EMI or prepayment on a loan account — backend splits it into interest expense + principal transfer. */
  recordLoanPayment: async (id: string, amount: number, fromAccountId?: string): Promise<LoanPaymentResult> =>
    (await apiClient.post<ApiResponse<LoanPaymentResult>>(`/accounts/${id}/loan-payment`, { amount, fromAccountId })).data.data,
};
