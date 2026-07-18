import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {MonthlyTrend} from "@/features/dashboard/types/dashboard.types";

export const analyticsApi = {
  getAnnualTrend: async (year: number): Promise<MonthlyTrend[]> => {
    const { data } = await apiClient.get<ApiResponse<MonthlyTrend[]>>(`/analytics/annual?year=${year}`);
    return data.data;
  },
};
