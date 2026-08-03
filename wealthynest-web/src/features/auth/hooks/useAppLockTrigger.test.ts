import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAppLockTrigger } from "./useAppLockTrigger";
import { useAuthStore } from "../store/auth.store";
import { useAppLockStore, writePersistedHiddenAt, readPersistedHiddenAt, markBiometricPromptStarting, __resetBiometricPromptStateForTests } from "../store/appLock.store";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { consumeNativeBackgroundedAt } from "@/lib/nativeBridge";
import { isBiometricHardwareAvailable, isBiometricUnlockEnabled } from "../utils/nativeBiometric";
import type { User } from "../types/auth.types";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })) },
}));
vi.mock("@/lib/nativeBridge", () => ({
  consumeNativeBackgroundedAt: vi.fn(() => null),
}));
// isNativePlatform is left as the real pass-through (it just reads the mocked Capacitor.isNativePlatform
// above), so mockedIsNativePlatform stays the single source of truth for "are we on native" across
// both this file's own native-only behavior and useNativeBiometricStatus's — only the two async
// device checks need their own controllable mocks here.
vi.mock("../utils/nativeBiometric", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/nativeBiometric")>();
  return {
    ...actual,
    isBiometricHardwareAvailable: vi.fn(() => Promise.resolve(false)),
    isBiometricUnlockEnabled: vi.fn(() => Promise.resolve(false)),
  };
});

const mockedIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockedAddListener = vi.mocked(App.addListener);
const mockedConsumeNativeBackgroundedAt = vi.mocked(consumeNativeBackgroundedAt);
const mockedIsBiometricHardwareAvailable = vi.mocked(isBiometricHardwareAvailable);
const mockedIsBiometricUnlockEnabled = vi.mocked(isBiometricUnlockEnabled);

const pinUser: User = {
  id: "u1", fullName: "Alice", email: "a@x.com", role: "MEMBER",
  active: true, createdAt: "2026-01-01", pinEnabled: true, hasPasskeys: false,
};

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, userVersion: 0 });
  useAppLockStore.setState({ isLocked: false });
  mockedIsNativePlatform.mockReturnValue(false);
  mockedIsBiometricHardwareAvailable.mockResolvedValue(false);
  mockedIsBiometricUnlockEnabled.mockResolvedValue(false);
  mockedConsumeNativeBackgroundedAt.mockReturnValue(null);
  __resetBiometricPromptStateForTests();
  setVisibility("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAppLockTrigger", () => {
  it("never locks a user with neither PIN nor a passkey configured", async () => {
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    setVisibility("hidden");
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("locks a PIN-enabled user who returns from a long background", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden");
    vi.advanceTimersByTime(91_000);
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // A true zero-grace policy was tried and reverted — switching to another app (an OTP, a
  // notification) and coming right back within the grace window must not re-lock; only a
  // genuinely long background, or a real close+reopen (covered separately below via the native
  // marker), should.
  it("does NOT lock when returning from background within the grace period", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden");
    vi.advanceTimersByTime(1_000);
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

  // hasPasskeys comes straight from the persisted auth store now (see useAppLockTrigger's own doc
  // comment) - armed is true from the very first render, no query resolution to wait on.
  it("arms for a passkey-only user (no PIN) via the persisted hasPasskeys flag, and locks after a long background", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false, hasPasskeys: true }, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    setVisibility("hidden");
    vi.advanceTimersByTime(91_000);
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // Regression coverage for a real, reported bug: `armed` used to check only PIN and passkeys —
  // useNativeBiometricStatus() was called here purely to warm its cache for AppLockScreen, with its
  // result never actually read into `armed`. A user who removed their passkeys (and never set a
  // PIN) but still had native fingerprint unlock on ended up with `armed` permanently false: the
  // lock screen never triggered on background/foreground or a fresh app open, letting them straight
  // into the dashboard with no prompt at all, despite biometric unlock showing "on" in Settings.
  it("arms for a native-biometric-only user (no PIN, no passkeys) and locks after a long background", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
    mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    // Waiting merely for the mock to have been *called* isn't enough — the query still needs to
    // resolve and re-render with armed=true before the effect (re-)registers its listeners. `ready`
    // only flips true once that's happened, so it's the right synchronization point here.
    await waitFor(() => expect(result.current.ready).toBe(true));

    vi.useFakeTimers();
    setVisibility("hidden");
    vi.advanceTimersByTime(91_000);
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("does NOT arm for a user with no PIN, no passkeys, and native biometric unlock turned off", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
    mockedIsBiometricUnlockEnabled.mockResolvedValue(false); // hardware's there, but the user hasn't turned it on
    useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));

    vi.useFakeTimers();
    setVisibility("hidden");
    vi.advanceTimersByTime(91_000);
    setVisibility("visible");

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  // Regression coverage for a real bug: the in-memory hiddenAtRef this hook used to rely on
  // exclusively dies with the JS context, so fully closing the tab/app and reopening it never
  // re-locked, even though the persisted auth session resumed right where it left off.
  it("locks immediately on a fresh mount if the persisted hidden-at marker shows any elapsed background time (tab/app fully closed and reopened)", () => {
    writePersistedHiddenAt(Date.now() - 120_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // A fresh mount ignores the grace period entirely, even when the marker is only a few seconds
  // old — a marker found at mount time was necessarily written by a JS context that no longer
  // exists (this is a fresh process), which only happens on a real close+reopen. "Even for a
  // sec" was the explicit, deliberate ask for exactly this case — it's answered differently from
  // "was this a brief ordinary app switch," which is what the grace period is for (see the
  // resume-path tests instead).
  it("locks on a fresh mount even if the persisted hidden-at marker is only a few seconds old", () => {
    writePersistedHiddenAt(Date.now() - 5_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // Regression coverage for a real bug found in live device testing: the visibilitychange/
  // pagehide/pause-resume trio above still occasionally missed a real task-swipe-away close,
  // since none of those WebView-level events are actually guaranteed to fire (or finish their
  // localStorage write) before the process dies. MainActivity.onPause() is a guaranteed Android
  // lifecycle callback with a blocking SharedPreferences commit(), so it's folded in here as a
  // second, more reliable source for the same "hidden at" decision.
  it("locks on a fresh mount from a native-reported background timestamp past the grace period, even with no localStorage marker at all", () => {
    mockedConsumeNativeBackgroundedAt.mockReturnValue(Date.now() - 120_000);
    expect(readPersistedHiddenAt()).toBeNull(); // nothing from the JS side — only native has it
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // Same "mount ignores grace" reasoning as above — a native-reported marker discovered at mount
  // time means MainActivity.onPause() fired for a JS context that's since been replaced by this
  // fresh one, i.e. a real close+reopen, regardless of how few seconds it reports.
  it("locks on a fresh mount from a native-reported background timestamp, even a recent one", () => {
    mockedConsumeNativeBackgroundedAt.mockReturnValue(Date.now() - 5_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // The mount-vs-resume distinction in action: the exact same recent native-reported timestamp
  // that locks unconditionally at mount time (test above) gets the grace period instead when it
  // surfaces via a resume event on an instance that was already mounted — because that can only
  // happen if the JS context survived, i.e. an ordinary same-process app switch, not a close.
  it("does NOT lock from that same kind of native-reported timestamp when it arrives via resume on an already-mounted instance", () => {
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper }); // mount: nothing pending yet
    expect(useAppLockStore.getState().isLocked).toBe(false);

    mockedConsumeNativeBackgroundedAt.mockReturnValue(Date.now() - 5_000);
    setVisibility("hidden");
    setVisibility("visible"); // resume, same instance — grace applies

    expect(useAppLockStore.getState().isLocked).toBe(false);
  });

  it("does not let a native-reported timestamp clobber a marker the JS side already wrote", () => {
    const jsWrittenAt = Date.now() - 120_000; // past grace — locks, so the marker isn't cleared
    writePersistedHiddenAt(jsWrittenAt);
    mockedConsumeNativeBackgroundedAt.mockReturnValue(Date.now() - 999_999); // also past grace, but much older
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
    // The JS-written value survives untouched — native only seeds the marker when nothing's
    // already pending, so it can never overwrite whatever visibilitychange/pagehide already wrote.
    expect(readPersistedHiddenAt()).toBe(jsWrittenAt);
  });

  // Regression coverage for a real, live bug: showing the native BiometricPrompt pauses the
  // hosting Activity (system UI taking focus, same as any dialog), so Capacitor's pause→resume
  // bridge fires around the app's OWN fingerprint ceremony too, not just around the user actually
  // leaving. With a zero-grace policy that pause/resume blip alone was enough to re-lock the
  // instant the prompt succeeded — which re-fired the same auto-triggering prompt: an infinite
  // unlock loop. isBiometricPromptActive() (set by AppLockScreen around the real ceremony) must
  // suppress this.
  it("does not lock from a pause/resume blip while a biometric ceremony we triggered is in flight", () => {
    markBiometricPromptStarting(); // real (unmocked) module state — as AppLockScreen does
    // Deliberately past the grace period — without the suppression below, this alone would lock;
    // proves the ceremony check is what's preventing it, not the grace period doing so anyway.
    writePersistedHiddenAt(Date.now() - 120_000);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(false);
    expect(readPersistedHiddenAt()).toBeNull(); // discarded, not left to be replayed later
  });

  // Regression coverage for the other half of the same bug: isLocked itself isn't persisted
  // (appLock.store's own deliberate design), so a plain refresh while genuinely locked used to
  // wipe the lock and let the user straight back in with no PIN/passkey check.
  it("keeps re-locking on every subsequent mount until a real unlock, so refreshing the lock screen cannot bypass it", () => {
    writePersistedHiddenAt(Date.now() - 120_000);
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
  it("pagehide also persists the hidden-at marker, so a fresh mount still locks even if visibilitychange never fired", () => {
    vi.useFakeTimers();
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    const { unmount } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    // No visibilitychange at all — only pagehide, simulating the Android task-kill case where
    // visibilitychange never fires before the process dies.
    window.dispatchEvent(new Event("pagehide"));
    unmount(); // the old JS context dying, same as a real tab/app close

    vi.advanceTimersByTime(91_000); // > BACKGROUND_GRACE_MS, simulating real time passing while closed
    useAppLockStore.setState({ isLocked: false }); // a brand-new store instance, same as a real cold start
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  // Regression coverage for a real bug: on Android, plain backgrounding — pressing Home or
  // switching apps, then reopening from the launcher — is by far the most common "close and
  // reopen," and it's an Activity onStop/onResume, not a page teardown. The WebView has no
  // obligation to fire `visibilitychange` for that (it isn't a web tab-visibility change), so
  // relying on visibilitychange/pagehide alone left this exact, ordinary case unlocked on return.
  // `@capacitor/app`'s pause/resume events are Capacitor's bridge over the real native lifecycle
  // and are the reliable signal visibilitychange was standing in for.
  it("relocks via the native pause/resume bridge on a native platform, independent of visibilitychange", async () => {
    mockedIsNativePlatform.mockReturnValue(true);
    let pauseCb: (() => void) | undefined;
    let resumeCb: (() => void) | undefined;
    mockedAddListener.mockImplementation(((event: string, cb: () => void) => {
      if (event === "pause") pauseCb = cb;
      if (event === "resume") resumeCb = cb;
      return Promise.resolve({ remove: vi.fn() });
    }) as unknown as typeof App.addListener);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });
    // Real timers here — App.addListener's mocked promise needs to resolve before the fake-timer
    // switch below, and RTL's waitFor polls via a real setTimeout that fake timers would never advance.
    await waitFor(() => expect(pauseCb).toBeDefined());
    await waitFor(() => expect(resumeCb).toBeDefined());

    // No visibilitychange at all — only the native bridge, simulating a real Android Home-button
    // background/reopen where the WebView never fires the web event.
    vi.useFakeTimers();
    pauseCb!();
    vi.advanceTimersByTime(91_000); // > BACKGROUND_GRACE_MS
    resumeCb!();

    expect(useAppLockStore.getState().isLocked).toBe(true);
  });

  it("does not register the native pause/resume bridge on web", () => {
    mockedIsNativePlatform.mockReturnValue(false);
    useAuthStore.setState({ user: pinUser, isAuthenticated: true });
    const { Wrapper } = createQueryClientWrapper();
    renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

    expect(mockedAddListener).not.toHaveBeenCalled();
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

  describe("ready", () => {
    // Regression coverage for a real bug: DashboardLayout used to paint real dashboard content
    // as soon as `isAuthenticated` was true, then lock a moment later once the passkeys query
    // resolved — visibly flashing the actual dashboard on every refresh for a passkey-only user.
    // hasPasskeys is synchronous now (see useAppLockTrigger's doc comment) so that specific flash
    // can't happen anymore; native-biometric status is the one signal below still worth covering.
    it("is true immediately for a PIN-enabled user, without waiting on anything async", () => {
      useAuthStore.setState({ user: pinUser, isAuthenticated: true });
      const { Wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

      expect(result.current.ready).toBe(true);
    });

    it("is true immediately when not authenticated at all", () => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
      const { Wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

      expect(result.current.ready).toBe(true);
    });

    // hasPasskeys/pinEnabled are both synchronous (persisted auth store), so with neither set, the
    // one remaining thing `ready` can legitimately wait on is the native-biometric status query —
    // still async even on web, where its queryFn short-circuits but is still wrapped in a Promise.
    it("is false for a PIN-less, passkey-less user until native-biometric status resolves, then true", async () => {
      useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
      const { Wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

      expect(result.current.ready).toBe(false);
      await waitFor(() => expect(result.current.ready).toBe(true));
    });

    // Same flash-of-unlocked-dashboard risk guarded against above, but forcing the native platform
    // branch of the same query specifically.
    it("is false for a PIN-less, passkey-less native user until biometric status resolves, then true", async () => {
      mockedIsNativePlatform.mockReturnValue(true);
      mockedIsBiometricHardwareAvailable.mockResolvedValue(true);
      mockedIsBiometricUnlockEnabled.mockResolvedValue(true);
      useAuthStore.setState({ user: { ...pinUser, pinEnabled: false }, isAuthenticated: true });
      const { Wrapper } = createQueryClientWrapper();
      const { result } = renderHook(() => useAppLockTrigger(), { wrapper: Wrapper });

      expect(result.current.ready).toBe(false);
      await waitFor(() => expect(result.current.ready).toBe(true));
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
