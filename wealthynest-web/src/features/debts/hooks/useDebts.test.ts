import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useDebts, useCreateDebt, useUpdateDebt, useRecordDebtPayment, useDeleteDebtPayment, useSettleDebt, useDeleteDebt } from "./useDebts";
import { debtsApi } from "../api/debts.api";
import { toast } from "sonner";

vi.mock("../api/debts.api", () => ({
  debtsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), recordPayment: vi.fn(), deletePayment: vi.fn(), settle: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(debtsApi);
const KEY = ["debts"];
const ALL_INVALIDATED_KEYS = [KEY, QUERY_KEYS.ACCOUNTS, QUERY_KEYS.DASHBOARD, QUERY_KEYS.EXPENSES];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDebts", () => {
  it("fetches without a type filter by default", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDebts(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getAll).toHaveBeenCalledWith(undefined);
  });

  it("fetches with the given type filter", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDebts("I_OWE" as never), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getAll).toHaveBeenCalledWith("I_OWE");
  });
});

describe("useCreateDebt", () => {
  it("invalidates debts/ACCOUNTS/DASHBOARD/EXPENSES and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateDebt(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Debt record added");
  });

  it("shows the backend's real error message and invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue({ response: { data: { message: "Amount must be positive" } } });
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateDebt(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Amount must be positive");
  });
});

describe("useUpdateDebt", () => {
  it("passes id/payload through", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateDebt(), { wrapper: Wrapper });
    result.current.mutate({ id: "d1", payload: { amount: 500 } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("d1", { amount: 500 });
  });
});

describe("useRecordDebtPayment", () => {
  it("passes id/payload through and toasts on success", async () => {
    mockedApi.recordPayment.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRecordDebtPayment(), { wrapper: Wrapper });
    result.current.mutate({ id: "d1", payload: { amount: 200 } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Payment recorded");
  });
});

describe("useDeleteDebtPayment", () => {
  it("passes id/paymentId through, invalidates debts/ACCOUNTS/DASHBOARD/EXPENSES, and toasts on success", async () => {
    mockedApi.deletePayment.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteDebtPayment(), { wrapper: Wrapper });
    result.current.mutate({ id: "d1", paymentId: "p1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.deletePayment).toHaveBeenCalledWith("d1", "p1");
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Payment removed");
  });

  it("invalidates nothing and shows the backend's error message on failure", async () => {
    mockedApi.deletePayment.mockRejectedValue({ response: { data: { message: "Payment not found" } } });
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteDebtPayment(), { wrapper: Wrapper });
    result.current.mutate({ id: "d1", paymentId: "p1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Payment not found");
  });
});

describe("useSettleDebt", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.settle.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useSettleDebt(), { wrapper: Wrapper });
    result.current.mutate("d1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Debt settled");
  });
});

describe("useDeleteDebt", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteDebt(), { wrapper: Wrapper });
    result.current.mutate("d1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Debt record deleted");
  });
});
