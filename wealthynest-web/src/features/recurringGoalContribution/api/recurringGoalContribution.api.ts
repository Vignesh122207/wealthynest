import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {RecurringGoalContribution} from "../types/recurringGoalContribution.types";

export interface CreateRecurringGoalContributionPayload {
  goalId:     string;
  amount:     number;
  dayOfMonth: number;
}

export interface UpdateRecurringGoalContributionPayload {
  goalId?:     string;
  amount?:     number;
  dayOfMonth?: number;
}

export const recurringGoalContributionApi = {
  getAll: async (): Promise<RecurringGoalContribution[]> =>
    (await apiClient.get<ApiResponse<RecurringGoalContribution[]>>("/recurring-goal-contribution")).data.data,

  create: async (payload: CreateRecurringGoalContributionPayload): Promise<RecurringGoalContribution> =>
    (await apiClient.post<ApiResponse<RecurringGoalContribution>>("/recurring-goal-contribution", payload)).data.data,

  update: async (id: string, payload: UpdateRecurringGoalContributionPayload): Promise<RecurringGoalContribution> =>
    (await apiClient.put<ApiResponse<RecurringGoalContribution>>(`/recurring-goal-contribution/${id}`, payload)).data.data,

  toggle: async (id: string): Promise<RecurringGoalContribution> =>
    (await apiClient.patch<ApiResponse<RecurringGoalContribution>>(`/recurring-goal-contribution/${id}/toggle`)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/recurring-goal-contribution/${id}`);
  },
};
