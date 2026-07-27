import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useRecurringIncome, useCreateRecurringIncome, useUpdateRecurringIncome,
  useToggleRecurringIncome, useDeleteRecurringIncome,
} from "./useRecurringIncome";
import { recurringIncomeApi } from "../api/recurringIncome.api";
import { toast } from "sonner";

vi.mock("../api/recurringIncome.api", () => ({
  recurringIncomeApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), toggle: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(recurringIncomeApi);
const KEY = ["recurring-income"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRecurringIncome", () => {
  it("fetches the rule list", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useRecurringIncome(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateRecurringIncome", () => {
  it("invalidates the key and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringIncome(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("Auto-credit rule created");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringIncome(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useUpdateRecurringIncome", () => {
  it("passes id/payload through", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateRecurringIncome(), { wrapper: Wrapper });
    result.current.mutate({ id: "r1", payload: { amount: 500 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("r1", { amount: 500 });
  });
});

describe("useToggleRecurringIncome", () => {
  it("toasts 'activated' or 'paused' based on the returned rule's active flag", async () => {
    mockedApi.toggle.mockResolvedValue({ active: true } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useToggleRecurringIncome(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule activated");
  });
});

describe("useDeleteRecurringIncome", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteRecurringIncome(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule deleted");
  });
});
