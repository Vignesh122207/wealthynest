import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { CreateIncomePayload, IncomeEntry } from "../types/income.types";

export const incomeApi = {
  getIncome: async (year?: number, month?: number, includeDebt?: boolean): Promise<IncomeEntry[]> => {
    const params = new URLSearchParams();
    if (year)         params.append("year",        String(year));
    if (month)        params.append("month",       String(month));
    if (includeDebt)  params.append("includeDebt", "true");
    return (await apiClient.get<ApiResponse<IncomeEntry[]>>(`/income?${params}`)).data.data;
  },
  createIncome: async (p: CreateIncomePayload): Promise<IncomeEntry> =>
    (await apiClient.post<ApiResponse<IncomeEntry>>("/income", p)).data.data,
  updateIncome: async (id: string, p: Partial<CreateIncomePayload>): Promise<IncomeEntry> =>
    (await apiClient.put<ApiResponse<IncomeEntry>>(`/income/${id}`, p)).data.data,
  deleteIncome: async (id: string): Promise<void> => { await apiClient.delete(`/income/${id}`); },
};
