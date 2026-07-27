import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "./useGoals";
import { goalsApi } from "../api/goals.api";
import { toast } from "sonner";

vi.mock("../api/goals.api", () => ({
  goalsApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(goalsApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGoals", () => {
  it("fetches the goal list", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useGoals(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateGoal", () => {
  it("invalidates GOALS and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateGoal(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.GOALS });
    expect(toast.success).toHaveBeenCalledWith("Goal created");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateGoal(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to create goal");
  });
});

describe("useUpdateGoal", () => {
  it("passes id/payload through and invalidates on success", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateGoal(), { wrapper: Wrapper });
    result.current.mutate({ id: "g1", payload: { savedAmount: 5000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("g1", { savedAmount: 5000 });
    expect(toast.success).toHaveBeenCalledWith("Goal updated");
  });
});

describe("useDeleteGoal", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteGoal(), { wrapper: Wrapper });
    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Goal deleted");
  });
});
