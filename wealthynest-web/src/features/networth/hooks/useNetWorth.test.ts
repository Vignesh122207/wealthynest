import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useNetWorthSummary, useNetWorthHistory } from "./useNetWorth";
import { networthApi } from "../api/networth.api";

vi.mock("../api/networth.api", () => ({
  networthApi: { getSummary: vi.fn(), getHistory: vi.fn() },
}));

const mockedApi = vi.mocked(networthApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNetWorthSummary", () => {
  it("fetches the net worth summary", async () => {
    mockedApi.getSummary.mockResolvedValue({ totalAssets: 500000, totalLiabilities: 100000 } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useNetWorthSummary(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalAssets: 500000, totalLiabilities: 100000 });
  });
});

describe("useNetWorthHistory", () => {
  it("fetches the net worth history", async () => {
    mockedApi.getHistory.mockResolvedValue([{ date: "2026-06-01", netWorth: 400000 }] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useNetWorthHistory(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getHistory).toHaveBeenCalled();
  });
});
