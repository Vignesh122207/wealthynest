import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { RecurringTransfer } from "../types/recurringTransfer.types";

export interface CreateRecurringTransferPayload {
  fromAccountId: string;
  toAccountId:   string;
  amount:        number;
  description?:  string;
  dayOfMonth:    number;
}

export interface UpdateRecurringTransferPayload {
  fromAccountId?: string;
  toAccountId?:   string;
  amount?:        number;
  description?:   string;
  dayOfMonth?:    number;
}

export const recurringTransferApi = {
  getAll: async (): Promise<RecurringTransfer[]> =>
    (await apiClient.get<ApiResponse<RecurringTransfer[]>>("/recurring-transfer")).data.data,

  create: async (payload: CreateRecurringTransferPayload): Promise<RecurringTransfer> =>
    (await apiClient.post<ApiResponse<RecurringTransfer>>("/recurring-transfer", payload)).data.data,

  update: async (id: string, payload: UpdateRecurringTransferPayload): Promise<RecurringTransfer> =>
    (await apiClient.put<ApiResponse<RecurringTransfer>>(`/recurring-transfer/${id}`, payload)).data.data,

  toggle: async (id: string): Promise<RecurringTransfer> =>
    (await apiClient.patch<ApiResponse<RecurringTransfer>>(`/recurring-transfer/${id}/toggle`)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/recurring-transfer/${id}`);
  },
};
