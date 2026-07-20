"use client";

import {useEffect, useRef} from "react";
import {useAuthStore} from "../store/auth.store";
import {useAppLockStore} from "../store/appLock.store";
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

  const hiddenAtRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!armed) return;

    const recordActivity = () => { lastActivityRef.current = Date.now(); };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      // visible again
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt > BACKGROUND_GRACE_MS) {
        lock();
      } else {
        recordActivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const idleInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS) lock();
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(idleInterval);
    };
  }, [armed, lock]);
}
