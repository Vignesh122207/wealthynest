import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { MySplits } from "../types/expensesplit.types";

export const expenseSplitsApi = {
  getMySplits: async (): Promise<MySplits> =>
    (await apiClient.get<ApiResponse<MySplits>>("/expense-splits/my-splits")).data.data,

  settle: async (id: string): Promise<void> => {
    await apiClient.post(`/expense-splits/${id}/settle`);
  },

  settleWith: async (counterpartId: string): Promise<void> => {
    await apiClient.post(`/expense-splits/settle-with/${counterpartId}`);
  },
};
