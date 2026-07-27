import {Capacitor} from "@capacitor/core";

declare global {
  interface Window {
    NativeSplash?: { notifyReady?: () => void };
    NativeAppLock?: { consumeBackgroundedAt?: () => number };
  }
}

/** One-shot signal to MainActivity.java that the first real screen — the login form, or the
 * dashboard/app-lock decision — has actually painted. The native splash waits on this (with a
 * floor and a ceiling — see MainActivity's own comment) instead of a blind fixed timer, so it no
 * longer hides on schedule and reveals a blank/white WebView while this server.url network fetch
 * is still loading. No-op outside the native shell (web/PWA has no splash to release) and safe to
 * call more than once — MainActivity's flag is a one-way latch. */
export function notifyNativeSplashReady(): void {
  if (!Capacitor.isNativePlatform()) return;
  window.NativeSplash?.notifyReady?.();
}

/** Epoch-ms timestamp of the last time MainActivity.onPause() fired, or null if there's nothing
 * pending (already consumed, or never happened). Backed by Android SharedPreferences with a
 * blocking commit() — see MainActivity's own comment for why this is more reliable than the
 * WebView-side visibilitychange/pagehide events for surviving a real task-swipe-away process kill.
 * Read-and-clear: each call consumes the value, so useAppLockTrigger can fold this straight into
 * its own persisted "hidden at" marker without a second, parallel clear-semantics to reason about. */
export function consumeNativeBackgroundedAt(): number | null {
  if (!Capacitor.isNativePlatform()) return null;
  const value = window.NativeAppLock?.consumeBackgroundedAt?.();
  return value && value > 0 ? value : null;
}
