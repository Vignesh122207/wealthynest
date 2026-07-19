import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense } from "./useExpenses";
import { expensesApi } from "../api/expenses.api";
import { toast } from "sonner";

vi.mock("../api/expenses.api", () => ({
  expensesApi: { getExpenses: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(expensesApi);
const ALL_INVALIDATED_KEYS = [QUERY_KEYS.EXPENSES, QUERY_KEYS.DASHBOARD, QUERY_KEYS.ACCOUNTS, QUERY_KEYS.BUDGETS];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useExpenses", () => {
  it("fetches when enabled (default)", async () => {
    mockedApi.getExpenses.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useExpenses(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("does not fetch when explicitly disabled", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useExpenses({}, false), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getExpenses).not.toHaveBeenCalled();
  });
});

describe("useCreateExpense", () => {
  it("invalidates EXPENSES/DASHBOARD/ACCOUNTS/BUDGETS/family-expenses and toasts on success", async () => {
    mockedApi.createExpense.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateExpense(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["family-expenses"] });
    expect(toast.success).toHaveBeenCalledWith("Expense added");
  });

  it("shows the backend's real error message and invalidates nothing on failure", async () => {
    mockedApi.createExpense.mockRejectedValue({ response: { data: { message: "Category is archived" } } });
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateExpense(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Category is archived");
  });
});

describe("useUpdateExpense", () => {
  it("passes id/payload through to the api", async () => {
    mockedApi.updateExpense.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateExpense(), { wrapper: Wrapper });
    result.current.mutate({ id: "e1", payload: { amount: 500 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateExpense).toHaveBeenCalledWith("e1", { amount: 500 });
    expect(toast.success).toHaveBeenCalledWith("Expense updated");
  });
});

describe("useDeleteExpense", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.deleteExpense.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteExpense(), { wrapper: Wrapper });
    result.current.mutate("e1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Expense deleted");
  });
});
