import {describe, it, expect, vi, beforeEach} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {createQueryClientWrapper} from "@/test-utils/queryClientWrapper";
import {useCurrencyRates} from "./useCurrencyRates";
import {currencyApi} from "../api/currency.api";

vi.mock("../api/currency.api", () => ({
  currencyApi: { getRates: vi.fn() },
}));

const mockedApi = vi.mocked(currencyApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCurrencyRates", () => {
  it("fetches and returns live rates", async () => {
    mockedApi.getRates.mockResolvedValue({
      base: "INR", rates: { USD: 0.012, EUR: 0.011 }, fetchedAt: "2026-08-07T00:00:00Z", stale: false,
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCurrencyRates(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rates.USD).toBe(0.012);
  });

  it("surfaces an error state when the endpoint fails, without throwing", async () => {
    mockedApi.getRates.mockRejectedValue(new Error("rates unavailable"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCurrencyRates(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
