import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { RecurringIncome } from "../types/recurringIncome.types";

export interface CreateRecurringIncomePayload {
  accountId:    string;
  source:       string;
  amount:       number;
  description?: string;
  dayOfMonth:   number;
}

export interface UpdateRecurringIncomePayload {
  accountId?:   string;
  source?:      string;
  amount?:      number;
  description?: string;
  dayOfMonth?:  number;
}

export const recurringIncomeApi = {
  getAll: async (): Promise<RecurringIncome[]> =>
    (await apiClient.get<ApiResponse<RecurringIncome[]>>("/recurring-income")).data.data,

  create: async (payload: CreateRecurringIncomePayload): Promise<RecurringIncome> =>
    (await apiClient.post<ApiResponse<RecurringIncome>>("/recurring-income", payload)).data.data,

  update: async (id: string, payload: UpdateRecurringIncomePayload): Promise<RecurringIncome> =>
    (await apiClient.put<ApiResponse<RecurringIncome>>(`/recurring-income/${id}`, payload)).data.data,

  toggle: async (id: string): Promise<RecurringIncome> =>
    (await apiClient.patch<ApiResponse<RecurringIncome>>(`/recurring-income/${id}/toggle`)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/recurring-income/${id}`);
  },
};
