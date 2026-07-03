import { apiClient } from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types/api.types";
import type { CreateExpensePayload, Expense, ExpenseFilters } from "../types/expense.types";

export const expensesApi = {
  getExpenses: async (filters: ExpenseFilters = {}): Promise<PagedResponse<Expense>> => {
    const params = new URLSearchParams();
    if (filters.categoryId)  params.append("categoryId", filters.categoryId);
    if (filters.startDate)   params.append("startDate",  filters.startDate);
    if (filters.endDate)     params.append("endDate",    filters.endDate);
    if (filters.search)      params.append("search",     filters.search);
    if (filters.minAmount)   params.append("minAmount",  String(filters.minAmount));
    if (filters.maxAmount)   params.append("maxAmount",  String(filters.maxAmount));
    if (filters.recurring   != null) params.append("recurring",   String(filters.recurring));
    if (filters.includeDebt != null) params.append("includeDebt", String(filters.includeDebt));
    if (filters.sortBy)      params.append("sortBy",     filters.sortBy);
    if (filters.sortDir)     params.append("sortDir",    filters.sortDir);
    filters.accountIds?.forEach(id => params.append("accountIds", id));
    params.append("page", String(filters.page ?? 0));
    params.append("size", String(filters.size ?? 100));
    const { data } = await apiClient.get<PagedResponse<Expense>>(`/expenses?${params}`);
    return data;
  },

  createExpense: async (payload: CreateExpensePayload): Promise<Expense> =>
    (await apiClient.post<ApiResponse<Expense>>("/expenses", payload)).data.data,

  updateExpense: async (id: string, payload: Partial<CreateExpensePayload>): Promise<Expense> =>
    (await apiClient.put<ApiResponse<Expense>>(`/expenses/${id}`, payload)).data.data,

  deleteExpense: async (id: string): Promise<void> => {
    await apiClient.delete(`/expenses/${id}`);
  },
};
