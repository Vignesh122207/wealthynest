import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useRecurringGoalContribution, useCreateRecurringGoalContribution,
  useUpdateRecurringGoalContribution, useToggleRecurringGoalContribution,
  useDeleteRecurringGoalContribution,
} from "./useRecurringGoalContribution";
import { recurringGoalContributionApi } from "../api/recurringGoalContribution.api";
import { toast } from "sonner";

vi.mock("../api/recurringGoalContribution.api", () => ({
  recurringGoalContributionApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), toggle: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(recurringGoalContributionApi);
const KEY = ["recurring-goal-contribution"];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRecurringGoalContribution", () => {
  it("fetches the rule list", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useRecurringGoalContribution(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateRecurringGoalContribution", () => {
  it("invalidates the key and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: KEY });
    expect(toast.success).toHaveBeenCalledWith("Auto-contribution rule created");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to create rule");
  });
});

describe("useUpdateRecurringGoalContribution", () => {
  it("passes id/payload through", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate({ id: "r1", payload: { amount: 500 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("r1", { amount: 500 });
  });
});

describe("useToggleRecurringGoalContribution", () => {
  it("toasts 'activated' when the toggled rule is now active", async () => {
    mockedApi.toggle.mockResolvedValue({ active: true } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useToggleRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule activated");
  });

  it("toasts 'paused' when the toggled rule is now inactive", async () => {
    mockedApi.toggle.mockResolvedValue({ active: false } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useToggleRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule paused");
  });
});

describe("useDeleteRecurringGoalContribution", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteRecurringGoalContribution(), { wrapper: Wrapper });
    result.current.mutate("r1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Rule deleted");
  });
});
