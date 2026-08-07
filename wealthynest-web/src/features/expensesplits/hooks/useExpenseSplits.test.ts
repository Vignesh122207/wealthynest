import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useMySplits, useSettleSplit, useSettleWithCounterpart, useExpenseSplitsForExpense, useAddExpenseSplits } from "./useExpenseSplits";
import { expenseSplitsApi } from "../api/expensesplits.api";
import { toast } from "sonner";

vi.mock("../api/expensesplits.api", () => ({
  expenseSplitsApi: { getMySplits: vi.fn(), settle: vi.fn(), settleWith: vi.fn(), getForExpense: vi.fn(), addToExpense: vi.fn() },
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

describe("useExpenseSplitsForExpense", () => {
  it("fetches splits for the given expense when an id is provided", async () => {
    mockedApi.getForExpense.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useExpenseSplitsForExpense("e1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getForExpense).toHaveBeenCalledWith("e1");
  });

  it("does not fetch when no expense id is provided", () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useExpenseSplitsForExpense(undefined), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getForExpense).not.toHaveBeenCalled();
  });
});

describe("useAddExpenseSplits", () => {
  const FOR_EXPENSE_KEY = ["expense-splits", "for-expense", "e1"];

  it("invalidates both the per-expense and my-splits keys and toasts on success", async () => {
    mockedApi.addToExpense.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddExpenseSplits("e1"), { wrapper: Wrapper });
    result.current.mutate([{ userId: "u2", shareAmount: 25 }]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.addToExpense).toHaveBeenCalledWith("e1", [{ userId: "u2", shareAmount: 25 }]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: FOR_EXPENSE_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("Split added");
  });

  it("shows the backend's own error message on failure", async () => {
    mockedApi.addToExpense.mockRejectedValue({ response: { data: { message: "Split shares can't add up to more than the expense amount." } } });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAddExpenseSplits("e1"), { wrapper: Wrapper });
    result.current.mutate([{ userId: "u2", shareAmount: 999 }]);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Split shares can't add up to more than the expense amount.");
  });
});
