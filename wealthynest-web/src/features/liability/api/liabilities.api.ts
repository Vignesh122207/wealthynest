import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { Liability, CreateLiabilityPayload } from "../types/liability.types";

export const liabilitiesApi = {
  getAll: async (): Promise<Liability[]> =>
    (await apiClient.get<ApiResponse<Liability[]>>("/liabilities")).data.data,

  create: async (p: CreateLiabilityPayload): Promise<Liability> =>
    (await apiClient.post<ApiResponse<Liability>>("/liabilities", p)).data.data,

  update: async (id: string, p: CreateLiabilityPayload): Promise<Liability> =>
    (await apiClient.put<ApiResponse<Liability>>(`/liabilities/${id}`, p)).data.data,

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/liabilities/${id}`);
  },
};
