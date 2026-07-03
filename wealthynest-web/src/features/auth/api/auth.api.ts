import { apiClient } from "@/lib/axios";
import type { ApiResponse } from "@/types/api.types";
import type { AuthResponse, LoginPayload, RegisterPayload, User } from "../types/auth.types";

export const authApi = {
  login:    async (p: LoginPayload):    Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/login",    p)).data.data,
  register: async (p: RegisterPayload): Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/register", p)).data.data,
  refresh:  async (refreshToken: string): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/refresh", { refreshToken })).data.data,
  logout:   async (refreshToken: string): Promise<void> => { await apiClient.post("/auth/logout", { refreshToken }); },
  getMe:    async (): Promise<User> => (await apiClient.get<ApiResponse<User>>("/users/me")).data.data,
  updateProfile: async (data: { fullName?: string; email?: string }): Promise<User> =>
    (await apiClient.patch<ApiResponse<User>>("/users/me", data)).data.data,
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post("/users/me/change-password", data);
  },
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post("/auth/forgot-password", { email });
  },
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post("/auth/reset-password", { token, newPassword });
  },
  closeAccount: async (): Promise<void> => {
    await apiClient.delete("/users/me");
  },
  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
  },
  resendVerification: async (email: string): Promise<void> => {
    await apiClient.post(`/auth/resend-verification?email=${encodeURIComponent(email)}`);
  },
};
