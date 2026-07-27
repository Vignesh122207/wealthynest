import axios, {AxiosError, AxiosInstance, InternalAxiosRequestConfig} from "axios";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {clearPersistedHiddenAt} from "@/features/auth/store/appLock.store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Sends/accepts the httpOnly refresh-token cookie (RefreshCookieService on the backend) — the
  // API and web app are on different subdomains of the same registrable domain, so this is a
  // same-site, not cross-site, credentialed request; CORS already has allowCredentials(true) set
  // to match.
  withCredentials: true,
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
      // No body needed — the refresh token rides along as an httpOnly cookie the browser attaches
      // automatically (see RefreshCookieService). Use a plain axios instance (not apiClient) to
      // avoid re-triggering this interceptor if the refresh call itself gets a 401, but still pass
      // withCredentials explicitly since this bypasses apiClient's own instance-level default.
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
      const { accessToken: newAccessToken } = data.data;

      useAuthStore.getState().setTokens(newAccessToken);

      // Unblock all waiting requests with the new token.
      processQueue(null, newAccessToken);

      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(original);
    } catch (refreshError) {
      // Refresh failed — reject every waiting request and force logout. This path bypasses
      // useLogout()'s mutation (no server call makes sense — the token that would authorize it is
      // exactly what just failed to refresh), so it has to clear the app-lock "went hidden at"
      // marker itself too, same as that hook's onSettled does — otherwise a stale marker left over
      // from *this* session lingers in localStorage and immediately re-locks (and can auto-fire a
      // passkey prompt) the moment the user's *next* fresh login lands on the dashboard, even
      // though they just proved who they are.
      processQueue(refreshError, null);
      useAuthStore.getState().logout();
      clearPersistedHiddenAt();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
