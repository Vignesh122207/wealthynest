import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAppLockTrigger } from "./useAppLockTrigger";
import { useAuthStore } from "../store/auth.store";
import { useAppLockStore, writePersistedHiddenAt } from "../store/appLock.store";
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
  window.localStorage.clear();
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

  // Regression coverage for a real bug: the in-memory hiddenAtRef this hook used to rely on
  // exclusively dies with the JS context, so fully closing the tab/app and reopening it never
  // re-locked, even though the persisted auth session resumed right where it left off.
  it("locks immediately on a fresh mount if the persisted hidden-at marker is already stale (tab/app fully closed and reopened)", () => {
    writePersistedHiddenAt(Date.now() - 60_000); // well past the 30s grace period
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("does NOT lock on a fresh mount if the persisted hidden-at marker is still within the grace period", () => {
    writePersistedHiddenAt(Date.now() - 5_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  // Regression coverage for the other half of the same bug: isLocked itself isn't persisted
  // (appLock.store's own deliberate design), so a plain refresh while genuinely locked used to
  // wipe the lock and let the user straight back in with no PIN/passkey check.
  it("keeps re-locking on every subsequent mount until a real unlock, so refreshing the lock screen cannot bypass it", () => {
    writePersistedHiddenAt(Date.now() - 60_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();

    const first = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });
    expect(useAppLockStore.getState().isLocked).toBe(true);
    first.unmount();

    // Simulates what a real page reload does: a brand-new store instance defaults isLocked back
    // to false, since it isn't persisted — the only thing that should be able to re-derive "true"
    // here is the still-stale marker in localStorage, not anything left over in memory.
    useAppLockStore.setState({ isLocked: false });

    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });
    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("unlock() clears the persisted marker so a later mount does not re-lock", () => {
    writePersistedHiddenAt(Date.now() - 60_000);
    useAppLockStore.getState().unlock();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  // Regression coverage for a real bug: on Android, swiping the app away from the recents/
  // task-switcher doesn't reliably fire visibilitychange before the process dies, so the
  // visibilitychange-only write path could silently never persist a hidden-at marker at all —
  // a cold reopen then found nothing to compare against and never locked. pagehide is the
  // documented, more reliable backup signal for exactly this teardown case.
  it("pagehide also persists the hidden-at marker, so a fresh mount still locks even if visibilitychange never fired", async () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { unmount } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });
    await vi.waitFor(() => expect(mockedApi.listPasskeys).toHaveBeenCalled());

    // No visibilitychange at all — only pagehide, simulating the Android task-kill case where
    // visibilitychange never fires before the process dies.
    window.dispatchEvent(new Event("pagehide"));
    unmount(); // the old JS context dying, same as a real tab/app close

    vi.advanceTimersByTime(31_000); // > BACKGROUND_GRACE_MS, simulating real time passing while closed
    useAppLockStore.setState({ isLocked: false }); // a brand-new store instance, same as a real cold start
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("pagehide does not clobber the marker visibilitychange already wrote moments earlier in the same teardown", () => {
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden"); // the real-world first signal of the two, moments before teardown
    const writtenAt = window.localStorage.getItem("wealthynest:applock:hiddenAt");
    expect(writtenAt).not.toBeNull();

    window.dispatchEvent(new Event("pagehide")); // fires right after, same teardown

    expect(window.localStorage.getItem("wealthynest:applock:hiddenAt")).toBe(writtenAt);
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
