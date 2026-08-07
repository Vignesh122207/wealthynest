import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {ExpenseSplit, MySplits, SplitParticipantPayload} from "../types/expensesplit.types";

export const expenseSplitsApi = {
  getMySplits: async (): Promise<MySplits> =>
    (await apiClient.get<ApiResponse<MySplits>>("/expense-splits/my-splits")).data.data,

  settle: async (id: string): Promise<void> => {
    await apiClient.post(`/expense-splits/${id}/settle`);
  },

  settleWith: async (counterpartId: string): Promise<void> => {
    await apiClient.post(`/expense-splits/settle-with/${counterpartId}`);
  },

  getForExpense: async (expenseId: string): Promise<ExpenseSplit[]> =>
    (await apiClient.get<ApiResponse<ExpenseSplit[]>>(`/expense-splits/expense/${expenseId}`)).data.data,

  addToExpense: async (expenseId: string, splitWith: SplitParticipantPayload[]): Promise<void> => {
    await apiClient.post(`/expense-splits/expense/${expenseId}`, { splitWith });
  },
};
