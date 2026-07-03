import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store/auth.store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Token Refresh Queue ────────────────────────────────────────────────────────
// When the access token expires, multiple in-flight requests will each receive
// a 401. Without coordination, every one of them fires /auth/refresh in
// parallel, instantly exhausting the auth rate-limit bucket.
//
// This queue serialises the refresh: the first 401 starts the refresh and sets
// isRefreshing=true; every subsequent 401 that arrives while the refresh is
// still in-flight gets parked in pendingQueue. When the single refresh
// completes (or fails) the queue is flushed — either retrying every parked
// request with the new token, or rejecting them all so the user is logged out.
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null): void {
  for (const { resolve, reject } of pendingQueue) {
    if (error) reject(error);
    else resolve(token!);
  }
  pendingQueue = [];
}

// ── Request Interceptor ────────────────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("wealthynest-auth");
      if (raw) {
        const token = JSON.parse(raw)?.state?.accessToken;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch { /* ignore parse errors */ }
  }
  return config;
});

// ── Response Interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for 401s from non-auth endpoints that haven't
    // already been retried (guards against infinite retry if the server
    // returns 401 even after a valid new token, e.g. account suspended).
    const isAuthEndpoint = original?.url?.startsWith("/auth/");
    if (error.response?.status !== 401 || original?._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Park this request behind the in-progress refresh.
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        })
        .catch((err) => Promise.reject(err));
    }

    // This is the first 401 — take the lead on refreshing.
    original._retry = true;
    isRefreshing = true;

    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("wealthynest-auth") : null;
      const refreshToken = raw ? JSON.parse(raw)?.state?.refreshToken : null;
      if (!refreshToken) throw new Error("No refresh token");

      // Use a plain axios instance (not apiClient) to avoid re-triggering
      // this interceptor if the refresh call itself gets a 401.
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data.data;

      useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

      // Unblock all waiting requests with the new token.
      processQueue(null, newAccessToken);

      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      // Refresh failed — reject every waiting request and force logout.
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
