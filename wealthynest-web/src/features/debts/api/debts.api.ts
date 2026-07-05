import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { DebtRecord, DebtType } from "../types/debt.types";

export interface CreateDebtPayload {
  type:          DebtType;
  contactName:   string;
  contactPhone?: string;
  amount:        number;
  description?:  string;
  debtDate?:     string;
  dueDate?:      string;
  accountId?:    string;
}

export interface UpdateDebtPayload {
  contactName?:  string;
  contactPhone?: string;
  amount?:       number;
  description?:  string;
  debtDate?:     string;
  dueDate?:      string;
}

export interface RecordPaymentPayload {
  amount: number;
  note?:  string;
}

export const debtsApi = {
  getAll: async (type?: DebtType): Promise<DebtRecord[]> => {
    const params = type ? { type } : {};
    return (await apiClient.get<ApiResponse<DebtRecord[]>>("/debts", { params })).data.data;
  },

  create: async (payload: CreateDebtPayload): Promise<DebtRecord> =>
    (await apiClient.post<ApiResponse<DebtRecord>>("/debts", payload)).data.data,

  update: async (id: string, payload: UpdateDebtPayload): Promise<DebtRecord> =>
    (await apiClient.put<ApiResponse<DebtRecord>>(`/debts/${id}`, payload)).data.data,

  recordPayment: async (id: string, payload: RecordPaymentPayload): Promise<DebtRecord> =>
    (await apiClient.post<ApiResponse<DebtRecord>>(`/debts/${id}/payments`, payload)).data.data,

  settle: async (id: string): Promise<DebtRecord> =>
    (await apiClient.patch<ApiResponse<DebtRecord>>(`/debts/${id}/settle`)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/debts/${id}`);
  },
};
