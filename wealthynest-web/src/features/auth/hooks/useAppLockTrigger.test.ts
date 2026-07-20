import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAppLockTrigger } from "./useAppLockTrigger";
import { useAuthStore } from "../store/auth.store";
import { useAppLockStore } from "../store/appLock.store";
import { authApi } from "../api/auth.api";
import type { User } from "../types/auth.types";

vi.mock("../api/auth.api", () => ({
  authApi: { listPasskeys: vi.fn() },
}));

const mockedApi = vi.mocked(authApi);

const pinUser: User = {
  id: "u1", fullName: "Alice", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: true,
};

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, userVersion: 0 });
  useAppLockStore.setState({ isLocked: false });
  mockedApi.listPasskeys.mockResolvedValue([]);
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAppLockTrigger", () => {
  it("never locks a user with neither PIN nor a passkey configured", async () => {
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
    setVisibility("hidden");
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("locks a PIN-enabled user who returns from background past the grace period", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden");
    vi.advanceTimersByTime(31_000); // > 30s grace period
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("does NOT lock when returning from background within the grace period", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden");
    vi.advanceTimersByTime(10_000); // well under 30s
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("locks after 5 minutes idle while still visible, with no backgrounding at all", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    vi.advanceTimersByTime(5 * 60_000 + 20_000); // past the 5-min idle limit, plus one check interval

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("real activity resets the idle clock, so it does not lock", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    vi.advanceTimersByTime(4 * 60_000); // approaching, not past, the idle limit
    window.dispatchEvent(new Event("mousemove")); // resets the clock
    vi.advanceTimersByTime(4 * 60_000); // would have exceeded 5 min from the original start

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("arms for a passkey-only user (no PIN) once the passkey list resolves non-empty", async () => {
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
    mockedApi.listPasskeys.mockResolvedValue([{ id: "p1", createdAt: "2026-01-01" }]);
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    await waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());
    // Give the query a tick to resolve and the effect to re-run with armed=true.
    await waitFor(() => {
      setVisibility("hidden");
      setVisibility("visible");
    });
  });

  it("removes its listeners on unmount", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { unmount } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });
    unmount();

    setVisibility("hidden");
    vi.advanceTimersByTime(60_000);
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });
});
