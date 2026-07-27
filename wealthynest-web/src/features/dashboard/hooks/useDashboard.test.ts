import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useDashboard } from "./useDashboard";
import { dashboardApi } from "../api/dashboard.api";

vi.mock("../api/dashboard.api", () => ({
  dashboardApi: { getDashboard: vi.fn() },
}));

const mockedApi = vi.mocked(dashboardApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDashboard", () => {
  it("fetches the dashboard for the given year/month", async () => {
    mockedApi.getDashboard.mockResolvedValue({ netWorth: 100000 } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDashboard(2026, 7), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getDashboard).toHaveBeenCalledWith(2026, 7);
  });

  it("fetches with no arguments when year/month are omitted (current period)", async () => {
    mockedApi.getDashboard.mockResolvedValue({ netWorth: 100000 } as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDashboard(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getDashboard).toHaveBeenCalledWith(undefined, undefined);
  });
});
