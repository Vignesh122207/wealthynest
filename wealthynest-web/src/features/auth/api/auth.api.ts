import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {AuthResponse, LoginPayload, Passkey, RegisterPayload, User} from "../types/auth.types";

export const authApi = {
  login:    async (p: LoginPayload):    Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/login",    p)).data.data,
  register: async (p: RegisterPayload): Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/register", p)).data.data,
  refresh:  async (refreshToken: string): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/refresh", { refreshToken })).data.data,
  logout:   async (refreshToken: string): Promise<void> => { await apiClient.post("/auth/logout", { refreshToken }); },
  getMe:    async (): Promise<User> => (await apiClient.get<ApiResponse<User>>("/users/me")).data.data,
  updateProfile: async (data: { fullName?: string }): Promise<User> =>
    (await apiClient.patch<ApiResponse<User>>("/users/me", data)).data.data,
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post("/users/me/change-password", data);
  },
  changeEmail: async (data: { newEmail: string; currentPassword: string }): Promise<void> => {
    await apiClient.post("/users/me/change-email", data);
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
  enablePin: async (currentPassword: string, pin: string): Promise<void> => {
    await apiClient.post("/users/me/pin/enable", { currentPassword, pin });
  },
  disablePin: async (): Promise<void> => {
    await apiClient.post("/users/me/pin/disable");
  },
  pinLogin: async (refreshToken: string, pin: string): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/pin-login", { refreshToken, pin })).data.data,

  googleLogin: async (idToken: string, rememberMe: boolean): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/google-login", { idToken, rememberMe })).data.data,

  getPasskeyRegistrationOptions: async (): Promise<PublicKeyCredentialCreationOptionsJSON> =>
    (await apiClient.post<ApiResponse<PublicKeyCredentialCreationOptionsJSON>>("/users/me/webauthn/register/options")).data.data,
  verifyPasskeyRegistration: async (credential: PublicKeyCredentialJSON, nickname: string): Promise<void> => {
    await apiClient.post("/users/me/webauthn/register/verify", { credential, nickname });
  },
  listPasskeys: async (): Promise<Passkey[]> =>
    (await apiClient.get<ApiResponse<Passkey[]>>("/users/me/webauthn/passkeys")).data.data,
  deletePasskey: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/me/webauthn/passkeys/${id}`);
  },
  getPasskeyLoginOptions: async (email: string): Promise<PublicKeyCredentialRequestOptionsJSON> =>
    (await apiClient.post<ApiResponse<PublicKeyCredentialRequestOptionsJSON>>("/auth/webauthn/login/options", { email })).data.data,
  passkeyLogin: async (email: string, credential: PublicKeyCredentialJSON, rememberMe: boolean): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/webauthn/login/verify", { email, credential, rememberMe })).data.data,
};
