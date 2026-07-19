import {QueryCache, QueryClient} from "@tanstack/react-query";
import {toast} from "sonner";
import {apiErrorMessage} from "./utils";

// Mutations already toast their own success/error per-hook (see e.g. useDebts.ts) — this only
// covers reads. Without it, a failed useQuery just leaves `data` undefined and every page renders
// that identically to "no data yet", so a network blip looks like an empty account instead of an
// error. 401s are excluded: the axios interceptor already redirects to /login for those, and a
// toast right before that navigation just flashes and disappears.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const status = (error as { response?: { status: number } })?.response?.status;
      if (status === 401) return;
      // Stable id per query key so a query that's retrying/refetching replaces its own toast
      // instead of stacking a new one on top each time.
      toast.error(apiErrorMessage(error, "Couldn't load this — check your connection"), {
        id: `query-error-${query.queryHash}`,
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
