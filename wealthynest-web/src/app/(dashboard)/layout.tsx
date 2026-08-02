"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {Sidebar} from "@/components/layout/Sidebar";
import {MobileNav} from "@/components/layout/MobileNav";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {authApi} from "@/features/auth/api/auth.api";
import {useAppLockStore} from "@/features/auth/store/appLock.store";
import {useAppLockTrigger} from "@/features/auth/hooks/useAppLockTrigger";
import {AppLockScreen} from "@/features/auth/components/AppLockScreen";
import {NativeSplashReady} from "@/components/shared/NativeSplashReady";
import {useRegisterNativePush} from "@/features/notifications/hooks/useNativePush";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser } = useAuthStore();
  const isLocked  = useAppLockStore((s) => s.isLocked);
  const router    = useRouter();
  const [hydrated, setHydrated] = useState(false);

  const { ready: lockDecisionReady } = useAppLockTrigger();

  useEffect(() => { setHydrated(true); }, []);

  useRegisterNativePush(hydrated && isAuthenticated);

  // Sync user profile from server on every dashboard load so familyId / role
  // are always fresh (prevents stale persisted store after joining a family).
  //
  // Guarded by userVersion: this request is dispatched on mount, but if the user acts fast
  // enough (e.g. creating/joining a family right after landing on the page), a mutation's own
  // setUser() call can land *before* this resolves. Without the version check, this resync would
  // then overwrite that more recent update with the stale pre-mutation snapshot it originally
  // fetched — reverting familyId back to null and bouncing the UI back to onboarding right after
  // a successful create. Only apply the result if nothing else has updated the store since.
  //
  // Also gated on !isLocked (once lockDecisionReady, so a still-resolving passkey/biometric
  // decision doesn't let it slip through): this call is a cold-boot 401 into axios.ts's own
  // refresh-and-retry, same as any other request on a fresh load. Firing it while the lock screen
  // is up raced PIN/passkey unlock for the same single-use refresh-token cookie — this resync's
  // own refresh could rotate it moments before pinLogin()/unlockWithPasskey() presented the same
  // now-already-superseded cookie, which the backend correctly reads as an expired session and
  // AppLockScreen then shows as "Incorrect PIN" (real bug found via app-lock.spec.ts's own
  // reload-while-locked test, reproduced 3/3 times before this fix). Nothing meaningful to resync
  // yet anyway while the user hasn't proven who they are.
  useEffect(() => {
    if (!hydrated || !isAuthenticated || !lockDecisionReady || isLocked) return;
    const versionAtRequest = useAuthStore.getState().userVersion;
    authApi.getMe().then((freshUser) => {
      if (useAuthStore.getState().userVersion !== versionAtRequest) return;
      setUser(freshUser);
    }).catch(() => {});
  }, [hydrated, isAuthenticated, lockDecisionReady, isLocked, setUser]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace("/login");
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) return null;
  if (!isAuthenticated) return null;
  // Holds off on painting real (unlocked) dashboard content until we know for sure whether this
  // account should be locked — see useAppLockTrigger's `ready` doc comment. Without this, a
  // passkey-armed account would flash its actual dashboard on every refresh until the passkeys
  // list came back from the server and the lock screen caught up a moment later.
  if (!lockDecisionReady) return null;

  return (
    <div
      className="flex min-h-screen bg-background"
      // Padding-top (not body-level — see globals.css) clears the status bar. This stays within
      // one viewport because of Tailwind preflight's box-sizing:border-box, which is exactly what
      // lets Header keep behaving as "pinned, not actually scrolling" the way it already relied on.
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Cold-start entry point when logged in (capacitor.config.ts's server.url always loads
          /home first) — only reached once isLocked has already been decided, so this never fires
          a beat before AppLockScreen is actually in the tree. See NativeSplashReady's own comment. */}
      <NativeSplashReady />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      {/* inert while locked: keeps the still-mounted page (no data loss, no refetch) behind the
          lock screen out of tab order and screen-reader focus, not just visually obscured. */}
      <div className="contents" inert={isLocked || undefined}>
        <Sidebar />
        <div id="main-content" className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </div>
        <MobileNav />
      </div>
      {isLocked && <AppLockScreen />}
    </div>
  );
}
