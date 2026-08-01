import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import { apiClient } from "./axios";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { writePersistedHiddenAt, readPersistedHiddenAt } from "@/features/auth/store/appLock.store";

// A custom adapter (axios's own supported per-request override) short-circuits the actual network
// call while still running the real interceptor pipeline — exercises real behavior through the
// public API instead of reaching into axios's internal interceptor handler list.
function fakeAdapter(config: AxiosRequestConfig): Promise<AxiosResponse> {
  return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: config as never, request: {} });
}

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, userVersion: 0 });
  localStorage.clear();
});

describe("apiClient request interceptor", () => {
  it("attaches the Authorization header from the in-memory auth store when a token is present", async () => {
    useAuthStore.setState({ accessToken: "tok-abc" });

    const res = await apiClient.get("/ping", { adapter: fakeAdapter });

    expect(res.config.headers.Authorization).toBe("Bearer tok-abc");
  });

  it("sends no Authorization header when there is no access token", async () => {
    const res = await apiClient.get("/ping", { adapter: fakeAdapter });

    expect(res.config.headers.Authorization).toBeUndefined();
  });

  it("never reads the token from localStorage — only the in-memory store", async () => {
    // Even if something else wrote a token-shaped value to localStorage, the interceptor must not
    // pick it up: the access token is deliberately kept out of persisted storage (see
    // auth.store.ts's own comment on why) so an XSS foothold can't read a live token out of it.
    localStorage.setItem("wealthynest-auth", JSON.stringify({ state: { accessToken: "stale-from-storage" } }));

    const res = await apiClient.get("/ping", { adapter: fakeAdapter });

    expect(res.config.headers.Authorization).toBeUndefined();
  });
});

// A rejected custom adapter, shaped like what axios itself produces for a real 401 (error.config +
// error.response.status) — the interceptor only reads those two fields, so a plain object rejection
// exercises the real branch without needing a live backend.
function rejectWith401(config: AxiosRequestConfig) {
  return Promise.reject({ config, response: { status: 401, data: {}, statusText: "Unauthorized", headers: {}, config }, isAxiosError: true });
}

describe("apiClient response interceptor — token refresh on a 401", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: "expired-tok", isAuthenticated: true, userVersion: 0 });
    localStorage.clear();
    writePersistedHiddenAt(Date.now());
    // jsdom's real `window.location.href =` setter attempts an actual (unsupported) navigation —
    // swapped for a plain mutable object so the assignment is just observable state, not a thrown
    // "Not implemented: navigation" error.
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });

  it("refreshes the token and retries the original request", async () => {
    let calls = 0;
    const adapter = (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      calls += 1;
      return calls === 1
        ? rejectWith401(config)
        : Promise.resolve({ data: { ok: true }, status: 200, statusText: "OK", headers: {}, config: config as never, request: {} });
    };
    vi.spyOn(axios, "post").mockResolvedValue({ data: { data: { accessToken: "new-tok" } } } as never);

    const res = await apiClient.get("/ping", { adapter });

    expect(calls).toBe(2);
    expect(res.config.headers.Authorization).toBe("Bearer new-tok");
    expect(useAuthStore.getState().accessToken).toBe("new-tok");
    expect(window.location.href).toBe("");
  });

  it("forces logout and redirects to /login when the refresh call itself comes back 401 — the refresh token is genuinely invalid", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401, data: {} }, isAxiosError: true });

    await expect(apiClient.get("/ping", { adapter: rejectWith401 })).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(readPersistedHiddenAt()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  // Regression coverage: several page loads in quick succession (a flaky reconnect, rapid app
  // foreground/background) can each trigger their own refresh call and burn through
  // /auth/refresh's 10 req/min rate limit — the N+1th call getting 429'd used to be treated
  // identically to an invalid refresh token and nuked a perfectly valid session.
  it("leaves the session intact when the refresh call is rate-limited (429) rather than genuinely invalid", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 429, data: {} }, isAxiosError: true });

    await expect(apiClient.get("/ping", { adapter: rejectWith401 })).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("expired-tok");
    expect(readPersistedHiddenAt()).not.toBeNull();
    expect(window.location.href).toBe("");
  });

  it("leaves the session intact when the refresh call fails with a network error (no response at all)", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({ message: "Network Error", isAxiosError: true });

    await expect(apiClient.get("/ping", { adapter: rejectWith401 })).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(window.location.href).toBe("");
  });
});
