import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useMySplits, useSettleSplit, useSettleWithCounterpart } from "./useExpenseSplits";
import { expenseSplitsApi } from "../api/expensesplits.api";
import { toast } from "sonner";

vi.mock("../api/expensesplits.api", () => ({
  expenseSplitsApi: { getMySplits: vi.fn(), settle: vi.fn(), settleWith: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(expenseSplitsApi);
const KEY = ["expense-splits", "my-splits"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMySplits", () => {
  it("fetches splits when enabled", async () => {
    mockedApi.getMySplits.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMySplits(true), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getMySplits).toHaveBeenCalled();
  });

  it("does not fetch when disabled", async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useMySplits(false), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getMySplits).not.toHaveBeenCalled();
  });
});

describe("useSettleSplit", () => {
  it("invalidates the my-splits key and toasts on success", async () => {
    mockedApi.settle.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSettleSplit(), { wrapper: Wrapper });
    result.current.mutate("split-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("Split settled");
  });

  it("toasts an error and does not invalidate on failure", async () => {
    mockedApi.settle.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSettleSplit(), { wrapper: Wrapper });
    result.current.mutate("split-1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to settle split");
  });
});

describe("useSettleWithCounterpart", () => {
  it("invalidates the my-splits key and toasts on success", async () => {
    mockedApi.settleWith.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSettleWithCounterpart(), { wrapper: Wrapper });
    result.current.mutate("user-2");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.settleWith).toHaveBeenCalledWith("user-2");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("All settled up");
  });
});
