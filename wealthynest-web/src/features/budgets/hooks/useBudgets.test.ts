import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from "./useBudgets";
import { budgetsApi } from "../api/budgets.api";
import { toast } from "sonner";
import type { Budget } from "../types/budget.types";

vi.mock("../api/budgets.api", () => ({
  budgetsApi: {
    getBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(budgetsApi);

const sampleBudget: Budget = {
  id: "b1", categoryId: "c1", amount: 1000, spent: 200, annualSpent: 200, remaining: 800,
  percentUsed: 20, overBudget: false, periodMonth: 6, periodYear: 2026, alertThreshold: 80,
  alertTriggered: false, budgetType: "MONTHLY", shared: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useBudgets", () => {
  it("fetches budgets and includes year/month in the query key", async () => {
    mockedApi.getBudgets.mockResolvedValue([sampleBudget]);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useBudgets(2026, 6), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleBudget]);
    expect(mockedApi.getBudgets).toHaveBeenCalledWith(2026, 6);
  });

  it("surfaces a query error instead of hanging forever", async () => {
    mockedApi.getBudgets.mockRejectedValue(new Error("network down"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useBudgets(2026, 6), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateBudget", () => {
  it("invalidates BUDGETS and DASHBOARD and shows a success toast on success", async () => {
    mockedApi.createBudget.mockResolvedValue(sampleBudget);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBudget(), { wrapper: Wrapper });
    result.current.mutate({ categoryId: "c1", amount: 1000, budgetType: "MONTHLY" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.BUDGETS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(toast.success).toHaveBeenCalledWith("Budget created");
  });

  it("shows an error toast and does not invalidate any query on failure", async () => {
    mockedApi.createBudget.mockRejectedValue(new Error("Insufficient balance"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBudget(), { wrapper: Wrapper });
    result.current.mutate({ categoryId: "c1", amount: 1000, budgetType: "MONTHLY" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to create budget");
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useUpdateBudget", () => {
  it("calls the API with id/payload split apart and invalidates on success", async () => {
    mockedApi.updateBudget.mockResolvedValue(sampleBudget);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateBudget(), { wrapper: Wrapper });
    result.current.mutate({ id: "b1", payload: { amount: 2000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateBudget).toHaveBeenCalledWith("b1", { amount: 2000 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.BUDGETS });
    expect(toast.success).toHaveBeenCalledWith("Budget updated");
  });
});

describe("useDeleteBudget", () => {
  it("invalidates BUDGETS but not DASHBOARD on success", async () => {
    mockedApi.deleteBudget.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteBudget(), { wrapper: Wrapper });
    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.BUDGETS });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(toast.success).toHaveBeenCalledWith("Budget deleted");
  });

  it("shows an error toast on failure", async () => {
    mockedApi.deleteBudget.mockRejectedValue(new Error("boom"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteBudget(), { wrapper: Wrapper });
    result.current.mutate("b1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to delete budget");
  });
});
