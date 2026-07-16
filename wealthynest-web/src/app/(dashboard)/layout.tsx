"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { authApi } from "@/features/auth/api/auth.api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setUser } = useAuthStore();
  const router    = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  // Sync user profile from server on every dashboard load so familyId / role
  // are always fresh (prevents stale persisted store after joining a family).
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    authApi.getMe().then(setUser).catch(() => {});
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
      <Sidebar />
      <div id="main-content" className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
