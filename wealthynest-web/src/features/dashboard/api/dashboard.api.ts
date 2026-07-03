import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { DashboardData } from "../types/dashboard.types";

export const dashboardApi = {
  getDashboard: async (year?: number, month?: number): Promise<DashboardData> => {
    const params = new URLSearchParams();
    if (year)  params.append("year",  String(year));
    if (month) params.append("month", String(month));
    const { data } = await apiClient.get<ApiResponse<DashboardData>>(`/analytics/dashboard?${params}`);
    return data.data;
  },
};
