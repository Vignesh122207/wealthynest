"use client";

import {useLayoutEffect, useRef} from "react";
import {App} from "@capacitor/app";
import {Capacitor} from "@capacitor/core";
import {useAuthStore} from "../store/auth.store";
import {clearPersistedHiddenAt, isBiometricPromptActive, readPersistedHiddenAt, useAppLockStore, writePersistedHiddenAt} from "../store/appLock.store";
import {useNativeBiometricStatus} from "./useNativeBiometric";
import {consumeNativeBackgroundedAt} from "@/lib/nativeBridge";

// Backgrounded (tab hidden, PWA suspended, or — on mobile — this is what fires when the device
// screen locks, Home is pressed, or the app is closed/swiped away while WealthyNest is the active
// app) for longer than this before we ask for PIN/passkey again on return. Long enough that
// switching to another app to copy an OTP or check a notification and coming right back doesn't
// get punished; short enough that "left it on a table for a while" still gets covered. A true
// zero-grace policy was tried and reverted — it re-locked from the briefest, most ordinary app
// switch, which is a worse experience than the thing it was meant to fix (a real close+reopen not
// re-locking at all — that gap is now closed properly via the native onPause-backed marker below,
// not by removing grace entirely).
const BACKGROUND_GRACE_MS = 90_000;

// Idle while still visible/foregrounded — no mouse/keyboard/scroll activity at all — locks even
// without ever backgrounding the tab.
const IDLE_LIMIT_MS = 5 * 60_000;
const IDLE_CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Arms the app-wide lock screen for any user who has a fast local unlock method available (PIN,
 * a registered passkey, or native biometric unlock) — see the "who's covered" reasoning in
 * AppLockScreen's own comment for why this deliberately doesn't extend to password-only accounts.
 * Mount once, at the dashboard layout level; it only sets `isLocked`, DashboardLayout/AppLockScreen
 * own what happens with that.
 *
 * Returns `ready`: whether we can say for sure yet whether this account should be locked.
 * `pinEnabled` and `hasPasskeys` both come from the persisted auth store, so a PIN or passkey
 * decision is known synchronously on first render — no network round trip gates it (see
 * useRegisterPasskey/useDeletePasskey in useAuth.ts, which keep `hasPasskeys` current on their own
 * success instead of waiting for the next getMe() resync). Native-biometric status is the one
 * signal that still needs its own async check to resolve first (a real device/Keystore read on
 * native; an instant no-op on web). DashboardLayout holds off on painting real dashboard content
 * while `!ready`, instead of briefly showing it unlocked and only locking a moment later once that
 * resolves (a real, user-visible bug on refresh for biometric-only users — the dashboard would
 * flash before the lock screen caught up). */
export function useAppLockTrigger(): { ready: boolean } {
  const pinEnabled = useAuthStore((s) => s.user?.pinEnabled ?? false);
  const hasPasskeys = useAuthStore((s) => s.user?.hasPasskeys ?? false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Also read here (not just warmed for AppLockScreen to read later) — this used to only be
  // called for its cache-warming side effect, with `armed` below checking PIN/passkeys alone. That
  // silently left a native-biometric-only user (no PIN, no passkeys left after removing them) with
  // `armed` always false: the lock screen never triggered at all, letting anyone straight into the
  // dashboard on a fresh app open despite biometric unlock still showing "on" in Settings — a real,
  // reported bug, not a hypothetical.
  const { data: nativeBiometric, isLoading: nativeBiometricLoading } = useNativeBiometricStatus();
  const lock = useAppLockStore((s) => s.lock);

  const nativeBiometricEnabled = !!nativeBiometric?.available && !!nativeBiometric?.enabled;
  const armed = isAuthenticated && (pinEnabled || hasPasskeys || nativeBiometricEnabled);
  const ready = !isAuthenticated || pinEnabled || hasPasskeys || !nativeBiometricLoading;

  const lastActivityRef = useRef<number>(Date.now());

  // Layout effect (not a plain effect) so that when `armed` is already knowable synchronously on
  // first render (the PIN case), `lock()` — if warranted — runs before the browser paints, not
  // after. A plain `useEffect` here would let one frame of the real, unlocked dashboard paint
  // first and only lock a moment later, the same flash `ready` above closes for the passkey case.
  useLayoutEffect(() => {
    if (!armed) return;

    // localStorage (not a useRef) is the only record of "when did we go hidden" — an in-memory
    // ref dies along with the rest of the JS context on a real tab/app close, which is exactly
    // the case this needs to survive. Resolves whatever hidden period, if any, was already
    // pending when this mount started: still within grace clears it (nothing to do), past grace
    // locks — and deliberately does NOT clear it in that second case, so a refresh before the
    // user actually unlocks keeps re-deriving "locked" instead of silently admitting them.
    //
    // `applyGrace` distinguishes two genuinely different situations that were previously
    // conflated under one grace value: a *resume* event on an already-mounted instance (this
    // effect never tore down — the JS context survived, so it's an ordinary same-process app
    // switch, e.g. Home button then back) gets the grace period. The *mount-time* call below,
    // by contrast, only ever finds a marker here when it was written by a JS context that no
    // longer exists — the only way that happens is a real close (task-swiped-away or
    // OS-killed) and a fresh cold start on reopen. That must always lock, regardless of how
    // quickly the user came back — "even for a sec" was the explicit, deliberate ask for this
    // specific case, and it's a different question from "was this brief" the grace period
    // answers for an ordinary app switch.
    const resolvePendingHiddenPeriod = (applyGrace: boolean) => {
      // Native's onPause-based marker (see MainActivity's own comment) survives a real
      // task-swipe-away process kill more reliably than the localStorage writes below — fold it
      // into the same marker here so the rest of this function only has one source to reason
      // about. Only seeds it if nothing's already pending, so it can't clobber a more precise
      // timestamp visibilitychange/pagehide already wrote for the same teardown. Always consumed
      // (not just peeked), even in the biometric-prompt branch below, so it can't be picked up
      // stale by a later, unrelated resolve.
      const nativeBackgroundedAt = consumeNativeBackgroundedAt();

      // Showing our OWN fingerprint prompt pauses the hosting Activity — same as any system
      // dialog taking focus — so the pause/resume this ceremony causes is not a real
      // backgrounding. Without this, a zero-grace policy re-locked the instant the prompt
      // succeeded, which re-fired the very same auto-triggering prompt: an infinite loop. Discard
      // (not just ignore) any marker recorded during this window so it can't be replayed once the
      // ceremony's own noise has settled.
      if (isBiometricPromptActive()) {
        clearPersistedHiddenAt();
        return;
      }

      if (nativeBackgroundedAt !== null && readPersistedHiddenAt() === null) {
        writePersistedHiddenAt(nativeBackgroundedAt);
      }

      const hiddenAt = readPersistedHiddenAt();
      if (hiddenAt === null) return;
      const grace = applyGrace ? BACKGROUND_GRACE_MS : 0;
      if (Date.now() - hiddenAt > grace) {
        lock();
      } else {
        clearPersistedHiddenAt();
      }
    };
    resolvePendingHiddenPeriod(false);

    const recordActivity = () => { lastActivityRef.current = Date.now(); };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    // Only start tracking a NEW hidden period if one isn't already pending — both a page being
    // torn down (closed, reloaded, or the app killed) and the redundant pagehide/visibilitychange
    // pairing below can each fire their own "just went hidden" signal within the same teardown.
    // Treating a second one as fresh would clobber an already-aged, still-relevant timestamp with
    // a near-zero one an instant before the next mount needs to read it — exactly defeating the
    // case this persistence exists for.
    const markHiddenIfNotAlreadyPending = () => {
      if (readPersistedHiddenAt() === null) writePersistedHiddenAt(Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markHiddenIfNotAlreadyPending();
        return;
      }
      // This effect never tore down for this to fire — the JS context survived, so this is an
      // ordinary same-process app switch, not a close+reopen. Grace applies.
      resolvePendingHiddenPeriod(true);
      if (readPersistedHiddenAt() === null) recordActivity();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Real-device backup for `visibilitychange`: on Android, swiping the app away from the
    // recents/task-switcher (an actual close, not just backgrounding) doesn't reliably fire
    // `visibilitychange` before the process dies — the write above can silently never happen,
    // which is exactly why a cold reopen sometimes skipped the lock entirely. `pagehide` is the
    // documented, more reliable companion event for this specific gap (see the Page Lifecycle
    // API: https://developer.chrome.com/blog/page-lifecycle-api/#advice-hidden) — it doesn't
    // replace visibilitychange (which still drives the foreground/idle/grace-period logic above),
    // it's a second write path so at least one of the two actually lands before teardown.
    window.addEventListener("pagehide", markHiddenIfNotAlreadyPending);

    // The actual gap `pagehide` above doesn't close: plain backgrounding on Android — pressing
    // Home, or switching to another app, then reopening WealthyNest from the launcher — is by far
    // the most common "close and reopen" a user means, and it's an Activity onStop/onResume, not
    // a page teardown. Android's WebView has no obligation to fire `visibilitychange` for that
    // (it isn't a web-standard tab visibility change at all), so relying on it alone left this
    // exact, ordinary case unlocked on return — confirmed as the live bug, not a hypothetical:
    // `@capacitor/app` was already a dependency but was never actually wired up anywhere. Its
    // `pause`/`resume` events are Capacitor's own bridge over the real native lifecycle (Android
    // Activity onStop/onResume, iOS UIApplication background/foreground notifications — see the
    // plugin's own doc comments), which is the reliable signal `visibilitychange` was standing in
    // for. Native-only: on web/PWA there's no such bridge, and visibilitychange already covers it.
    let removeNativeListeners: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      Promise.all([
        App.addListener("pause", markHiddenIfNotAlreadyPending),
        App.addListener("resume", () => {
          // Same reasoning as the visibilitychange resume above — this instance stayed mounted
          // the whole time, so the process (and this listener) survived. Grace applies.
          resolvePendingHiddenPeriod(true);
          if (readPersistedHiddenAt() === null) recordActivity();
        }),
      ]).then(([pauseHandle, resumeHandle]) => {
        removeNativeListeners = () => { pauseHandle.remove(); resumeHandle.remove(); };
      });
    }

    const idleInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) lock();
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", markHiddenIfNotAlreadyPending);
      removeNativeListeners?.();
      window.clearInterval(idleInterval);
    };
  }, [armed, lock]);

  return { ready };
}
