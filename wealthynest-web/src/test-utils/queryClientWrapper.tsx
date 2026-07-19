import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** A fresh, retry-disabled QueryClient + provider wrapper for renderHook() in TanStack Query
 * hook tests — retries would otherwise make a mocked-rejection test wait through real backoff
 * delays before the mutation/query settles into its error state. */
export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}
