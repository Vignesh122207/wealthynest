"use client";

import {useEffect, useRef} from "react";
import {useAuthStore} from "../store/auth.store";
import {clearPersistedHiddenAt, readPersistedHiddenAt, useAppLockStore, writePersistedHiddenAt} from "../store/appLock.store";
import {usePasskeys} from "./useAuth";

// Backgrounded (tab hidden, PWA suspended, or — on mobile — this is what fires when the device
// screen locks while WealthyNest is the active app) for longer than this before we ask for
// PIN/passkey again on return. Long enough that switching apps to copy an OTP or check a
// notification doesn't get punished; short enough that "left it on a table for a minute" still
// gets covered.
const BACKGROUND_GRACE_MS = 30_000;

// Idle while still visible/foregrounded — no mouse/keyboard/scroll activity at all — locks even
// without ever backgrounding the tab.
const IDLE_LIMIT_MS = 5 * 60_000;
const IDLE_CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"] as const;

/** Arms the app-wide lock screen for any user who has a fast local unlock method available (PIN
 * or a registered passkey) — see the "who's covered" reasoning in AppLockScreen's own comment for
 * why this deliberately doesn't extend to password-only accounts. Mount once, at the dashboard
 * layout level; it only sets `isLocked`, DashboardLayout/AppLockScreen own what happens with that. */
export function useAppLockTrigger() {
  const pinEnabled = useAuthStore((s) => s.user?.pinEnabled ?? false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: passkeys } = usePasskeys();
  const lock = useAppLockStore((s) => s.lock);

  const armed = isAuthenticated && (pinEnabled || (passkeys?.length ?? 0) > 0);

  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!armed) return;

    // localStorage (not a useRef) is the only record of "when did we go hidden" — an in-memory
    // ref dies along with the rest of the JS context on a real tab/app close, which is exactly
    // the case this needs to survive. Resolves whatever hidden period, if any, was already
    // pending when this mount started: still within grace clears it (nothing to do), past grace
    // locks — and deliberately does NOT clear it in that second case, so a refresh before the
    // user actually unlocks keeps re-deriving "locked" instead of silently admitting them.
    const resolvePendingHiddenPeriod = () => {
      const hiddenAt = readPersistedHiddenAt();
      if (hiddenAt === null) return;
      if (Date.now() - hiddenAt > BACKGROUND_GRACE_MS) {
        lock();
      } else {
        clearPersistedHiddenAt();
      }
    };
    resolvePendingHiddenPeriod();

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
      resolvePendingHiddenPeriod();
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
      window.clearInterval(idleInterval);
    };
  }, [armed, lock]);
}
