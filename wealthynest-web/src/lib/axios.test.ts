import { describe, it, expect, beforeEach } from "vitest";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { apiClient } from "./axios";
import { useAuthStore } from "@/features/auth/store/auth.store";

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
