import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useIncome, useCreateIncome, useUpdateIncome, useDeleteIncome } from "./useIncome";
import { incomeApi } from "../api/income.api";
import { toast } from "sonner";

vi.mock("../api/income.api", () => ({
  incomeApi: { getIncome: vi.fn(), createIncome: vi.fn(), updateIncome: vi.fn(), deleteIncome: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(incomeApi);
const ALL_INVALIDATED_KEYS = [["income"], ["analytics"], QUERY_KEYS.ACCOUNTS, QUERY_KEYS.DASHBOARD, QUERY_KEYS.GOALS];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useIncome", () => {
  it("fetches with year/month/includeDebt passed through", async () => {
    mockedApi.getIncome.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useIncome(2026, 7, true), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getIncome).toHaveBeenCalledWith(2026, 7, true);
  });
});

describe("useCreateIncome", () => {
  it("invalidates income/analytics/ACCOUNTS/DASHBOARD/GOALS and toasts on success", async () => {
    mockedApi.createIncome.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateIncome(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Income recorded");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.createIncome.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateIncome(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to record income");
  });
});

describe("useUpdateIncome", () => {
  it("passes id/payload through to the api", async () => {
    mockedApi.updateIncome.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateIncome(), { wrapper: Wrapper });
    result.current.mutate({ id: "i1", payload: { amount: 1000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateIncome).toHaveBeenCalledWith("i1", { amount: 1000 });
    expect(toast.success).toHaveBeenCalledWith("Income updated");
  });
});

describe("useDeleteIncome", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.deleteIncome.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteIncome(), { wrapper: Wrapper });
    result.current.mutate("i1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Income entry deleted");
  });
});
