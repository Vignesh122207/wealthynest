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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser } = useAuthStore();
  const isLocked  = useAppLockStore((s) => s.isLocked);
  const router    = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useAppLockTrigger();

  useEffect(() => { setHydrated(true); }, []);

  // Sync user profile from server on every dashboard load so familyId / role
  // are always fresh (prevents stale persisted store after joining a family).
  //
  // Guarded by userVersion: this request is dispatched on mount, but if the user acts fast
  // enough (e.g. creating/joining a family right after landing on the page), a mutation's own
  // setUser() call can land *before* this resolves. Without the version check, this resync would
  // then overwrite that more recent update with the stale pre-mutation snapshot it originally
  // fetched — reverting familyId back to null and bouncing the UI back to onboarding right after
  // a successful create. Only apply the result if nothing else has updated the store since.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    const versionAtRequest = useAuthStore.getState().userVersion;
    authApi.getMe().then((freshUser) => {
      if (useAuthStore.getState().userVersion !== versionAtRequest) return;
      setUser(freshUser);
    }).catch(() => {});
  }, [hydrated, isAuthenticated, setUser]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.replace("/login");
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-background">
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
