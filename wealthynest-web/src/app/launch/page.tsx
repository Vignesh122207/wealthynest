"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuthStore} from "@/features/auth/store/auth.store";

/** Capacitor's cold-start entry point (see capacitor.config.ts's server.url) instead of /home
 * directly. /home's own page statically imports ~9 TanStack Query hooks and every dashboard
 * widget (NetWorthTrend, SpendingDonut, SixMonthTrend, InvestmentPanel, DebtPulse, ...) — real
 * download+parse cost even for a visitor about to be redirected to /login by DashboardLayout,
 * since that redirect only fires after React decides not to render, by which point the browser
 * already downloaded and V8 already parsed/compiled the whole bundle to get there. Measured on a
 * real device/emulator: loading /home alone pushes the WebView renderer process from a ~150MB
 * baseline to 800MB+ within seconds — authenticated or not — eventually hitting a V8 "Ineffective
 * mark-compacts near heap limit" crash; every other route (including /login itself) stays flat.
 * This page imports nothing beyond the already-loaded root layout's auth store, so cold launch
 * only pays for whichever real destination it lands on, not both.
 */
export default function LaunchGate() {
  const router = useRouter();

  useEffect(() => {
    const { isAuthenticated } = useAuthStore.getState();
    router.replace(isAuthenticated ? "/home" : "/login");
  }, [router]);

  return null;
}
