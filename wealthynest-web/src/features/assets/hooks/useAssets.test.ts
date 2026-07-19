import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAssets, useNetWorth, useCreateAsset, useUpdateAsset, useDeleteAsset } from "./useAssets";
import { assetsApi } from "../api/assets.api";
import { toast } from "sonner";

vi.mock("../api/assets.api", () => ({
  assetsApi: { getAssets: vi.fn(), getNetWorth: vi.fn(), createAsset: vi.fn(), updateAsset: vi.fn(), deleteAsset: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(assetsApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAssets / useNetWorth", () => {
  it("fetches the asset list", async () => {
    mockedApi.getAssets.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useAssets(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("fetches the net worth figure", async () => {
    mockedApi.getNetWorth.mockResolvedValue(500000 as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useNetWorth(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

const ALL_INVALIDATED_KEYS = [
  QUERY_KEYS.ASSETS, QUERY_KEYS.NET_WORTH, QUERY_KEYS.NET_WORTH_SUMMARY, QUERY_KEYS.LIABILITIES, QUERY_KEYS.DASHBOARD,
];

describe("useCreateAsset", () => {
  it("invalidates ASSETS/NET_WORTH/NET_WORTH_SUMMARY/LIABILITIES/DASHBOARD and toasts on success", async () => {
    mockedApi.createAsset.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAsset(), { wrapper: Wrapper });
    result.current.mutate({ name: "House", assetType: "REAL_ESTATE", currentValue: 5000000 } as never);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Asset added");
  });

  it("toasts an error and invalidates nothing on failure", async () => {
    mockedApi.createAsset.mockRejectedValue(new Error("fail"));
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAsset(), { wrapper: Wrapper });
    result.current.mutate({} as never);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to add asset");
  });
});

describe("useUpdateAsset", () => {
  it("passes id/payload through and invalidates on success", async () => {
    mockedApi.updateAsset.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateAsset(), { wrapper: Wrapper });
    result.current.mutate({ id: "a1", payload: { name: "House" } as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateAsset).toHaveBeenCalledWith("a1", { name: "House" });
    expect(toast.success).toHaveBeenCalledWith("Asset updated");
  });
});

describe("useDeleteAsset", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.deleteAsset.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteAsset(), { wrapper: Wrapper });
    result.current.mutate("a1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Asset removed");
  });
});
