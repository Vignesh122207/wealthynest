import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAnnualTrend } from "./useAnalytics";
import { analyticsApi } from "../api/analytics.api";

vi.mock("../api/analytics.api", () => ({
  analyticsApi: { getAnnualTrend: vi.fn() },
}));

const mockedApi = vi.mocked(analyticsApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAnnualTrend", () => {
  it("fetches the annual trend for the given year", async () => {
    mockedApi.getAnnualTrend.mockResolvedValue([{ month: 1, income: 1000, expense: 500 }] as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAnnualTrend(2026), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getAnnualTrend).toHaveBeenCalledWith(2026);
    expect(result.current.data).toEqual([{ month: 1, income: 1000, expense: 500 }]);
  });

  it("does not fetch when enabled is false", async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAnnualTrend(2026, false), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getAnnualTrend).not.toHaveBeenCalled();
  });
});
