import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {CreateGoalPayload, Goal} from "../types/goal.types";

export const goalsApi = {
  getAll: async (): Promise<Goal[]> =>
    (await apiClient.get<ApiResponse<Goal[]>>("/goals")).data.data,

  create: async (payload: CreateGoalPayload): Promise<Goal> =>
    (await apiClient.post<ApiResponse<Goal>>("/goals", payload)).data.data,

  update: async (id: string, payload: Partial<CreateGoalPayload>): Promise<Goal> =>
    (await apiClient.put<ApiResponse<Goal>>(`/goals/${id}`, payload)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`);
  },
};
