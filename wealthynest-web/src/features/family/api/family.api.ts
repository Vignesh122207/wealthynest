import { apiClient } from "@/lib/axios";
import type { ApiResponse, PagedResponse } from "@/types/api.types";
import type { Family, FamilyMember, FamilyMonthlyStats } from "../types/family.types";
import type { Expense } from "@/features/expenses/types/expense.types";

export const familyApi = {
  createFamily: async (name: string): Promise<Family> =>
    (await apiClient.post<ApiResponse<Family>>("/families", { name })).data.data,

  joinFamily: async (inviteCode: string): Promise<Family> =>
    (await apiClient.post<ApiResponse<Family>>("/families/join", { inviteCode })).data.data,

  getFamily: async (id: string): Promise<Family> =>
    (await apiClient.get<ApiResponse<Family>>(`/families/${id}`)).data.data,

  getMembers: async (id: string): Promise<FamilyMember[]> =>
    (await apiClient.get<ApiResponse<FamilyMember[]>>(`/families/${id}/members`)).data.data,

  renameFamily: async (id: string, name: string): Promise<Family> =>
    (await apiClient.put<ApiResponse<Family>>(`/families/${id}`, { name })).data.data,

  leaveFamily: async (): Promise<void> => {
    await apiClient.post("/families/leave");
  },

  deleteFamily: async (id: string): Promise<void> => {
    await apiClient.delete(`/families/${id}`);
  },

  removeMember: async (familyId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/families/${familyId}/members/${memberId}`);
  },

  transferAdmin: async (familyId: string, newAdminId: string): Promise<void> => {
    await apiClient.post(`/families/${familyId}/transfer-admin`, { newAdminId });
  },

  revokeAdmin: async (familyId: string, targetId: string): Promise<void> => {
    await apiClient.delete(`/families/${familyId}/admin/${targetId}`);
  },

  getFamilyExpenses: async (familyId: string, startDate?: string, endDate?: string): Promise<Expense[]> => {
    const params: Record<string, string | number> = { page: 0, size: 500 };
    if (startDate) params.startDate = startDate;
    if (endDate)   params.endDate   = endDate;
    const res = await apiClient.get<PagedResponse<Expense>>(`/families/${familyId}/expenses`, { params });
    return res.data.data ?? [];
  },

  getFamilyNetWorth: async (familyId: string): Promise<number> =>
    (await apiClient.get<ApiResponse<number>>(`/families/${familyId}/net-worth`)).data.data ?? 0,

  getFamilyMonthlyStats: async (familyId: string, year: number, month: number): Promise<FamilyMonthlyStats> =>
    (await apiClient.get<ApiResponse<FamilyMonthlyStats>>(`/families/${familyId}/monthly-stats`, { params: { year, month } })).data.data,
};
