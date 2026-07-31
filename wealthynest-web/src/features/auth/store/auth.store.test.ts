import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth.store";
import type { User } from "../types/auth.types";

const user: User = {
  id: "u1", fullName: "Alice", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: false,
};

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, userVersion: 0 });
});

describe("useAuthStore persistence", () => {
  it("does not persist the access token to localStorage — only user and isAuthenticated", () => {
    useAuthStore.getState().setAuth(user, "live-access-token");

    const persisted = JSON.parse(localStorage.getItem("wealthynest-auth")!);

    expect(persisted.state.accessToken).toBeUndefined();
    expect(persisted.state.user).toEqual(user);
    expect(persisted.state.isAuthenticated).toBe(true);
    // Confirms it really is in memory, just not written to storage.
    expect(useAuthStore.getState().accessToken).toBe("live-access-token");
  });

  it("clears the in-memory access token on logout", () => {
    useAuthStore.getState().setAuth(user, "live-access-token");

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
