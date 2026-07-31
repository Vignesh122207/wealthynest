"use client";

import {useEffect} from "react";
import {useTheme} from "next-themes";
import {QueryClientProvider} from "@tanstack/react-query";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {queryClient} from "@/lib/queryClient";
import {registerServiceWorker} from "@/lib/serviceWorker";
import {syncNativeStatusBar} from "@/lib/nativeStatusBar";
import {useDeepLinkRouting} from "@/features/auth/hooks/useDeepLinkRouting";

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  // Root-level (not the dashboard layout) — verify-email/reset-password links land on the
  // logged-out (auth) route group, so this has to be live before any auth state is known.
  useDeepLinkRouting();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Re-syncs on every theme change (not just mount) so toggling light/dark in Settings updates
  // the status bar icon color live, the same way it updates every other themed surface.
  useEffect(() => {
    if (resolvedTheme === "light" || resolvedTheme === "dark") syncNativeStatusBar(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
