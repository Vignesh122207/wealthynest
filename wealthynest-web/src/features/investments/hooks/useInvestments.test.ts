import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import {
  useInvestments, useGoldPrice, useGoldPriceInfo, useCreateInvestment, useUpdateInvestment,
  useDeleteInvestment, useSipTransactions, useAddSipTransaction, useDeleteSipTransaction,
  useXirr, usePortfolioXirr, useTypeXirr, useDividendSuggestions, useIncomeHistory,
  useLogIncome, useDismissDividend, useAddStockTransaction, useStockTransactions,
  useDeleteStockTransaction,
} from "./useInvestments";
import { investmentsApi } from "../api/investments.api";
import { toast } from "sonner";

vi.mock("../api/investments.api", () => ({
  investmentsApi: {
    getInvestments: vi.fn(), getGoldPrice: vi.fn(), getGoldPriceInfo: vi.fn(),
    createInvestment: vi.fn(), updateInvestment: vi.fn(), deleteInvestment: vi.fn(),
    getSipTransactions: vi.fn(), addSipTransaction: vi.fn(), deleteSipTransaction: vi.fn(),
    getXirr: vi.fn(), getPortfolioXirr: vi.fn(), getTypeXirr: vi.fn(),
    getDividendSuggestions: vi.fn(), getIncomeHistory: vi.fn(), logIncome: vi.fn(),
    dismissDividend: vi.fn(), addStockTransaction: vi.fn(), getStockTransactions: vi.fn(),
    deleteStockTransaction: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(investmentsApi);
const ALL_INVALIDATED_KEYS = [
  QUERY_KEYS.INVESTMENTS, QUERY_KEYS.ASSETS, QUERY_KEYS.NET_WORTH_SUMMARY,
  QUERY_KEYS.DASHBOARD, QUERY_KEYS.ACCOUNTS, ["portfolio-xirr"], ["type-xirr"],
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useInvestments / useGoldPrice / useGoldPriceInfo", () => {
  it("fetches the investment list", async () => {
    mockedApi.getInvestments.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useInvestments(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("fetches the gold price", async () => {
    mockedApi.getGoldPrice.mockResolvedValue(6000 as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useGoldPrice(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("fetches gold price info", async () => {
    mockedApi.getGoldPriceInfo.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useGoldPriceInfo(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe("useCreateInvestment", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("invalidates the full set and toasts immediately on success", async () => {
    mockedApi.createInvestment.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateInvestment(), { wrapper: Wrapper });
    result.current.mutate({ investmentType: "MUTUAL_FUND" } as never);

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of ALL_INVALIDATED_KEYS) expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: key });
    expect(toast.success).toHaveBeenCalledWith("Investment added");
  });

  it("for a STOCK/BOND/FD, invalidates income-history and dividend-suggestions after a 6s delay", async () => {
    mockedApi.createInvestment.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateInvestment(), { wrapper: Wrapper });
    result.current.mutate({ investmentType: "STOCK" } as never);

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["income-history"] });

    await vi.advanceTimersByTimeAsync(6000);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["income-history"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dividend-suggestions"] });
  });

  it("for a non-backfill type (e.g. GOLD), never schedules the delayed invalidation", async () => {
    mockedApi.createInvestment.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateInvestment(), { wrapper: Wrapper });
    result.current.mutate({ investmentType: "GOLD" } as never);

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    invalidateSpy.mockClear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["income-history"] });
  });
});

describe("useUpdateInvestment", () => {
  it("passes id/payload through and invalidates on success", async () => {
    mockedApi.updateInvestment.mockResolvedValue({} as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useUpdateInvestment(), { wrapper: Wrapper });
    result.current.mutate({ id: "i1", payload: {} as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.updateInvestment).toHaveBeenCalledWith("i1", {});
    expect(toast.success).toHaveBeenCalledWith("Investment updated");
  });
});

describe("useDeleteInvestment", () => {
  it("invalidates and toasts on success", async () => {
    mockedApi.deleteInvestment.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteInvestment(), { wrapper: Wrapper });
    result.current.mutate("i1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Investment removed");
  });
});

describe("useSipTransactions", () => {
  it("is disabled when investmentId is null", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useSipTransactions(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAddSipTransaction", () => {
  it("invalidates sip/xirr for the investment plus the full set, and toasts", async () => {
    mockedApi.addSipTransaction.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddSipTransaction(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", data: {} as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sip", "i1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["xirr", "i1"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.INVESTMENTS });
    expect(toast.success).toHaveBeenCalledWith("SIP entry added");
  });
});

describe("useDeleteSipTransaction", () => {
  it("invalidates sip/xirr for the investment and toasts", async () => {
    mockedApi.deleteSipTransaction.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteSipTransaction(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", sipId: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("SIP entry deleted");
  });
});

describe("useXirr / usePortfolioXirr / useTypeXirr", () => {
  it("useXirr is disabled when investmentId is null", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useXirr(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("usePortfolioXirr fetches", async () => {
    mockedApi.getPortfolioXirr.mockResolvedValue(12.5 as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => usePortfolioXirr(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useTypeXirr respects the enabled flag", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useTypeXirr("STOCK" as never, false), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApi.getTypeXirr).not.toHaveBeenCalled();
  });
});

describe("useDividendSuggestions / useIncomeHistory", () => {
  it("useDividendSuggestions fetches", async () => {
    mockedApi.getDividendSuggestions.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useDividendSuggestions(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useIncomeHistory passes the year through", async () => {
    mockedApi.getIncomeHistory.mockResolvedValue([] as never);
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useIncomeHistory(2026), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.getIncomeHistory).toHaveBeenCalledWith(2026);
  });
});

describe("useLogIncome", () => {
  it("invalidates income-history/dividend-suggestions/ACCOUNTS/DASHBOARD and toasts", async () => {
    mockedApi.logIncome.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useLogIncome(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", data: { incomeType: "DIVIDEND", exDate: "2026-07-01", amount: 100 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["income-history"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dividend-suggestions"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ACCOUNTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(toast.success).toHaveBeenCalledWith("Dividend logged to income");
  });
});

describe("useDismissDividend", () => {
  it("invalidates dividend-suggestions with NO success toast", async () => {
    mockedApi.dismissDividend.mockResolvedValue(undefined as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDismissDividend(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", exDate: "2026-07-01" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dividend-suggestions"] });
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useAddStockTransaction", () => {
  it("invalidates stock-transactions for the investment plus the full set, and toasts", async () => {
    mockedApi.addStockTransaction.mockResolvedValue({} as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddStockTransaction(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", data: {} as never });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["stock-transactions", "i1"] });
    expect(toast.success).toHaveBeenCalledWith("Transaction recorded");
  });
});

describe("useStockTransactions", () => {
  it("respects the enabled flag", () => {
    const { Wrapper } = createQueryClientWrapper();
    const { result } = renderHook(() => useStockTransactions("i1", false), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useDeleteStockTransaction", () => {
  it("invalidates stock-transactions for the investment and toasts", async () => {
    mockedApi.deleteStockTransaction.mockResolvedValue(undefined as never);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteStockTransaction(), { wrapper: Wrapper });
    result.current.mutate({ investmentId: "i1", txnId: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Transaction removed");
  });
});
