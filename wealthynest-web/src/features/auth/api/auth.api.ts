import {apiClient} from "@/lib/axios";
import type {ApiResponse} from "@/types/api.types";
import type {AuthResponse, LoginPayload, Passkey, RegisterPayload, Session, User} from "../types/auth.types";

export const authApi = {
  login:    async (p: LoginPayload):    Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/login",    p)).data.data,
  register: async (p: RegisterPayload): Promise<AuthResponse> => (await apiClient.post<ApiResponse<AuthResponse>>("/auth/register", p)).data.data,
  // No body — the refresh token rides along as an httpOnly cookie the browser attaches
  // automatically (see RefreshCookieService on the backend).
  logout:   async (): Promise<void> => { await apiClient.post("/auth/logout"); },
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
  // No password step-up — see AuthServiceImpl#enablePin's own comment for why that's deliberate.
  enablePin: async (pin: string): Promise<void> => {
    await apiClient.post("/users/me/pin/enable", { pin });
  },
  disablePin: async (): Promise<void> => {
    await apiClient.post("/users/me/pin/disable");
  },
  // No refreshToken param — the anchoring session is read off the httpOnly cookie server-side.
  pinLogin: async (pin: string): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/pin-login", { pin })).data.data,

  googleLogin: async (idToken: string, rememberMe: boolean): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/google-login", { idToken, rememberMe })).data.data,

  // Native Android counterpart — sends the authorization code + PKCE verifier the Custom Tab
  // flow produced, not an ID token; the backend exchanges it for one server-side (see
  // GoogleSignInButton.tsx's NativeGoogleSignInButton and AuthServiceImpl.googleLoginNative for
  // why: Google requires a client secret for this exchange that the app can't safely hold).
  googleLoginNative: async (
    params: { code: string; redirectUri: string; codeVerifier: string; rememberMe: boolean }
  ): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/google-login-native", params)).data.data,

  // Web fallback used only when One Tap's silent prompt() is blocked/skipped (see
  // GoogleSignInButton.tsx's runPopupFallback) — same authorization-code shape as
  // googleLoginNative, minus codeVerifier, since GIS's initCodeClient popup mode never
  // establishes a PKCE challenge.
  googleLoginPopup: async (
    params: { code: string; redirectUri: string; rememberMe: boolean }
  ): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/google-login-popup", params)).data.data,

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
  // No previousRefreshToken param — this device's existing session (if any) is read off the
  // httpOnly cookie server-side, which lets the backend revoke that row instead of leaving it
  // active alongside the new one. See AuthService#issueTokensForVerifiedUser.
  passkeyLogin: async (
    email: string, credential: PublicKeyCredentialJSON, rememberMe: boolean
  ): Promise<AuthResponse> =>
    (await apiClient.post<ApiResponse<AuthResponse>>("/auth/webauthn/login/verify",
      { email, credential, rememberMe })).data.data,

  // POST, not GET, kept for route stability even though there's no body anymore — "which row is
  // this device" now comes from the httpOnly cookie riding along on the request itself.
  listSessions: async (): Promise<Session[]> =>
    (await apiClient.post<ApiResponse<Session[]>>("/users/me/sessions")).data.data,
  revokeSession: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/me/sessions/${id}`);
  },
  revokeOtherSessions: async (): Promise<void> => {
    await apiClient.post("/users/me/sessions/revoke-others");
  },
};
