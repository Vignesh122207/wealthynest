"use client";

import {useEffect, useRef} from "react";
import {usePathname, useRouter} from "next/navigation";
import {App} from "@capacitor/app";
import {Capacitor} from "@capacitor/core";

// The two places /launch (capacitor.config.ts's cold-start entry point) can land depending on
// auth state — there's nothing meaningful left to go "back" to from either. Capacitor's own
// default hardware-back-button handling (used automatically whenever nothing registers a
// 'backButton' listener, per its own docs) just walks raw WebView history depth instead — and
// this app's client-side router.push-heavy navigation keeps that history deep almost immediately:
// right after login it was /login underneath /home, so one back press from /home landed back on
// the login form despite being fully authenticated, and from deeper dashboard pages it could take
// many presses before ever reaching an exit ("back button doesn't close the app"). Registering our
// own listener replaces Capacitor's default outright, so exit-vs-navigate is driven by the app's
// own route tree instead of incidental history depth.
// "/launch" itself is included even though it only occupies the screen for the instant before its
// own redirect fires (see LaunchGate) — it's still the very first history entry on cold start, so
// a back press landing in that narrow window has nothing to go back to either. Without this,
// router.back() from there would silently no-op instead of exiting (history.back() with no prior
// entry does nothing) — a regression from Capacitor's own default, which treated an empty
// WebView history as exitable.
const EXIT_ROUTES = new Set(["/home", "/login", "/launch"]);

export function useHardwareBackButton() {
  const router = useRouter();
  const pathname = usePathname();
  // A ref, not a listener dependency — re-registering the native listener on every navigation
  // risks a brief window with no handler attached (or two attached at once) while the previous
  // add/remove promises settle. One listener for the component's lifetime, always reading
  // whichever pathname is current when the button is actually pressed.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;
    App.addListener("backButton", () => {
      if (EXIT_ROUTES.has(pathnameRef.current)) {
        App.exitApp();
      } else {
        router.back();
      }
    }).then((handle) => { removeListener = () => handle.remove(); });

    return () => { removeListener?.(); };
  }, [router]);
}
