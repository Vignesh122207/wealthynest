import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useLiabilities, useCreateLiability, useUpdateLiability, useDeleteLiability } from "./useLiabilities";
import { liabilitiesApi } from "../api/liabilities.api";
import { toast } from "sonner";

vi.mock("../api/liabilities.api", () => ({
  liabilitiesApi: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(liabilitiesApi);
const ALL_INVALIDATED_KEYS = [QUERY_KEYS.LIABILITIES, QUERY_KEYS.ASSETS, QUERY_KEYS.NET_WORTH, QUERY_KEYS.NET_WORTH_SUMMARY];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useLiabilities", () => {
  it("fetches the liability list", async () => {
    mockedApi.getAll.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useLiabilities(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateLiability", () => {
  it("invalidates LIABILITIES/ASSETS/NET_WORTH/NET_WORTH_SUMMARY and toasts on success", async () => {
    mockedApi.create.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateLiability(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Liability added");
  });

  it("invalidates nothing on failure", async () => {
    mockedApi.create.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateLiability(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to add liability");
  });
});

describe("useUpdateLiability", () => {
  it("passes id/payload through to the api", async () => {
    mockedApi.update.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateLiability(), { wrapper: Wrapper });
    result.current.mutate({ id: "l1", payload: { name: "Home Loan" } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.update).toHaveBeenCalledWith("l1", { name: "Home Loan" });
    expect(toast.success).toHaveBeenCalledWith("Liability updated");
  });
});

describe("useDeleteLiability", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.delete.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteLiability(), { wrapper: Wrapper });
    result.current.mutate("l1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Liability removed");
  });
});
