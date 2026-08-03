import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { queryClient } from "./queryClient";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

// retry: false — the default queryClient retries non-4xx failures twice, which would make these
// tests wait through real backoff delays before the query settles into its error state.
async function runQuery(key: string, error: unknown) {
  try {
    await queryClient.fetchQuery({ queryKey: [key], queryFn: () => Promise.reject(error), retry: false });
  } catch {
    // rejection is expected — the assertions below are on the onError side effect (the toast)
  }
}

describe("queryClient global error toast", () => {
  it("collapses simultaneous true network failures onto one shared toast id", async () => {
    // No `response` on the error — axios never got one back (offline/DNS/timeout) — as opposed to
    // a server responding with a 4xx/5xx.
    const networkError = { message: "Network Error" };
    await runQuery("a", networkError);
    await runQuery("b", networkError);

    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenNthCalledWith(1, expect.any(String), { id: "query-error-offline" });
    expect(toast.error).toHaveBeenNthCalledWith(2, expect.any(String), { id: "query-error-offline" });
  });

  it("keeps distinct per-query toast ids for real server errors so different resources still surface separately", async () => {
    const serverError = { response: { status: 500, data: {} } };
    await runQuery("c", serverError);
    await runQuery("d", serverError);

    const ids = vi.mocked(toast.error).mock.calls.map(([, opts]) => (opts as { id: string }).id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id !== "query-error-offline")).toBe(true);
  });

  it("skips the toast for 401s, which the axios interceptor already redirects to /login for", async () => {
    const authError = { response: { status: 401, data: {} } };
    await runQuery("e", authError);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("collapses simultaneous 429s onto one shared toast id, same as a real network outage", async () => {
    const rateLimitError = { response: { status: 429, data: { message: "Too many requests" } } };
    await runQuery("f", rateLimitError);
    await runQuery("g", rateLimitError);

    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenNthCalledWith(1, expect.any(String), { id: "query-error-rate-limited" });
    expect(toast.error).toHaveBeenNthCalledWith(2, expect.any(String), { id: "query-error-rate-limited" });
  });
});
