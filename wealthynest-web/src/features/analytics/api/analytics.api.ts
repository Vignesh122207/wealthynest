import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { DashboardData, MonthlyTrend } from "@/features/dashboard/types/dashboard.types";

export const analyticsApi = {
  getDashboard: async (year?: number, month?: number): Promise<DashboardData> => {
    const params = new URLSearchParams();
    if (year)  params.append("year",  String(year));
    if (month) params.append("month", String(month));
    return (await apiClient.get<ApiResponse<DashboardData>>(`/analytics/dashboard?${params}`)).data.data;
  },

  getAnnualTrend: async (year: number): Promise<MonthlyTrend[]> => {
    const { data } = await apiClient.get<ApiResponse<MonthlyTrend[]>>(`/analytics/annual?year=${year}`);
    return data.data;
  },
};
