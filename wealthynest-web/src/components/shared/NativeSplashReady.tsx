"use client";

import {useEffect} from "react";
import {notifyNativeSplashReady} from "@/lib/nativeBridge";

/** Rendered once, at the root of whichever screen is the cold-start entry point (AuthLayout for
 * the logged-out case, DashboardLayout for the logged-in case) — fires the instant that screen has
 * actually painted. A plain effect (not `useLayoutEffect`): the signal only needs to reach native
 * after the browser has committed a real frame, not before paint. */
export function NativeSplashReady() {
  useEffect(() => { notifyNativeSplashReady(); }, []);
  return null;
}
