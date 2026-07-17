import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { Budget, CreateBudgetPayload, UpdateBudgetPayload } from "../types/budget.types";

export const budgetsApi = {
  getBudgets: async (year?: number, month?: number): Promise<Budget[]> => {
    const params = new URLSearchParams();
    if (year)  params.append("year",  String(year));
    if (month) params.append("month", String(month));
    return (await apiClient.get<ApiResponse<Budget[]>>(`/budgets?${params}`)).data.data;
  },
  getBudgetsForCategory: async (categoryId: string, year: number, month: number): Promise<Budget[]> => {
    const params = new URLSearchParams({ categoryId, year: String(year), month: String(month) });
    return (await apiClient.get<ApiResponse<Budget[]>>(`/budgets/for-category?${params}`)).data.data;
  },
  createBudget: async (p: CreateBudgetPayload): Promise<Budget> =>
    (await apiClient.post<ApiResponse<Budget>>("/budgets", p)).data.data,
  updateBudget: async (id: string, p: UpdateBudgetPayload): Promise<Budget> =>
    (await apiClient.put<ApiResponse<Budget>>(`/budgets/${id}`, p)).data.data,
  deleteBudget: async (id: string): Promise<void> => { await apiClient.delete(`/budgets/${id}`); },
};
