import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useRecurringTransfer, useCreateRecurringTransfer, useUpdateRecurringTransfer,
  useToggleRecurringTransfer, useDeleteRecurringTransfer,
} from "./useRecurringTransfer";
import { recurringTransferApi } from "../api/recurringTransfer.api";
import { toast } from "sonner";

vi.mock("../api/recurringTransfer.api", () => ({
  recurringTransferApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), toggle: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(recurringTransferApi);
const KEY = ["recurring-transfer"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRecurringTransfer", () => {
  it("fetches the rule list", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useRecurringTransfer(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateRecurringTransfer", () => {
  it("invalidates the key and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringTransfer(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("Auto-transfer rule created");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringTransfer(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useUpdateRecurringTransfer", () => {
  it("passes id/payload through", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateRecurringTransfer(), { wrapper: Wrapper });
    result.current.mutate({ id: "r1", payload: { amount: 500 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("r1", { amount: 500 });
  });
});

describe("useToggleRecurringTransfer", () => {
  it("toasts 'paused' when the toggled rule is now inactive", async () => {
    mockedApi.toggle.mockResolvedValue({ active: false } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useToggleRecurringTransfer(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule paused");
  });
});

describe("useDeleteRecurringTransfer", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteRecurringTransfer(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule deleted");
  });
});
