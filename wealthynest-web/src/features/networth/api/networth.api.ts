import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { NetWorthSummary, NetWorthHistoryPoint } from "../types/networth.types";

export const networthApi = {
  getSummary: async (): Promise<NetWorthSummary> =>
    (await apiClient.get<ApiResponse<NetWorthSummary>>("/net-worth/summary")).data.data,

  getHistory: async (): Promise<NetWorthHistoryPoint[]> =>
    (await apiClient.get<ApiResponse<NetWorthHistoryPoint[]>>("/net-worth/history")).data.data,
};
