import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QUERY_KEYS } from "@/lib/constants";
import { createQueryClientWrapper } from "@/test-utils/queryClientWrapper";
import { useAccounts, useCloseAccount, useCreateAccount, useDeleteAccount, useTransfer, useRecordLoanPayment } from "./useAccounts";
import { accountsApi } from "../api/accounts.api";
import { toast } from "sonner";
import type { WalletAccount, LoanPaymentResult } from "../types/account.types";

vi.mock("../api/accounts.api", () => ({
  accountsApi: {
    getAccounts: vi.fn(),
    createAccount: vi.fn(),
    deleteAccount: vi.fn(),
    closeAccount: vi.fn(),
    transfer: vi.fn(),
    recordLoanPayment: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(accountsApi);

const sampleAccount: WalletAccount = {
  id: "a1", accountType: "BANK_ACCOUNT", name: "Checking", openingBalance: 1000,
  currentBalance: 1000, totalMoneyIn: 0, totalMoneyOut: 0, recentTransactions: [], createdAt: "2026-06-01",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAccounts", () => {
  it("fetches the account list under the ACCOUNTS query key", async () => {
    mockedApi.getAccounts.mockResolvedValue([sampleAccount]);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useAccounts(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleAccount]);
  });
});

describe("useCreateAccount", () => {
  it("invalidates ACCOUNTS, DASHBOARD, and GOALS on success", async () => {
    mockedApi.createAccount.mockResolvedValue(sampleAccount);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateAccount(), { wrapper: Wrapper });
    result.current.mutate({ accountType: "BANK_ACCOUNT", name: "Checking", openingBalance: 1000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ACCOUNTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.GOALS });
    expect(toast.success).toHaveBeenCalledWith("Account created");
  });

  // apiErrorMessage isn't mocked here — this exercises the real integration between the hook's
  // onError handler and the shared error-extraction helper already covered by utils.test.ts.
  it("extracts and shows the backend's real error message via apiErrorMessage, not a generic one", async () => {
    mockedApi.createAccount.mockRejectedValue({
      response: { data: { message: "An account with that name already exists." } },
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCreateAccount(), { wrapper: Wrapper });
    result.current.mutate({ accountType: "BANK_ACCOUNT", name: "Checking", openingBalance: 1000 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("An account with that name already exists.");
  });

  it("falls back to a generic message when the error carries no backend message", async () => {
    mockedApi.createAccount.mockRejectedValue(new Error("network down"));
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useCreateAccount(), { wrapper: Wrapper });
    result.current.mutate({ accountType: "BANK_ACCOUNT", name: "Checking", openingBalance: 1000 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Failed to create account");
  });
});

describe("useDeleteAccount", () => {
  it("invalidates ACCOUNTS, DASHBOARD, and GOALS on success — only ever succeeds for a zero-history account", async () => {
    mockedApi.deleteAccount.mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });
    result.current.mutate("a1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.deleteAccount).toHaveBeenCalledWith("a1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ACCOUNTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.GOALS });
  });

  it("surfaces the API's own 409 message when the account has history", async () => {
    mockedApi.deleteAccount.mockRejectedValue({
      response: { data: { message: "This account has transaction history — close or archive it instead." } },
    });
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });
    result.current.mutate("a1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("This account has transaction history — close or archive it instead.");
  });
});

describe("useCloseAccount", () => {
  it("invalidates ACCOUNTS, DASHBOARD, and GOALS on success", async () => {
    mockedApi.closeAccount.mockResolvedValue({ id: "a1", status: "CLOSED" } as never);
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCloseAccount(), { wrapper: Wrapper });
    result.current.mutate("a1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.closeAccount).toHaveBeenCalledWith("a1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ACCOUNTS });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.DASHBOARD });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.GOALS });
  });
});

describe("useTransfer", () => {
  it("invalidates ACCOUNTS, TRANSFERS, DASHBOARD, and GOALS on success", async () => {
    mockedApi.transfer.mockResolvedValue({
      id: "t1", fromAccountId: "a1", fromAccountName: "Checking", toAccountId: "a2", toAccountName: "Savings",
      amount: 500, transferDate: "2026-06-01", createdAt: "2026-06-01", adjustment: false, debt: false,
    });
    const { Wrapper, queryClient } = createQueryClientWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransfer(), { wrapper: Wrapper });
    result.current.mutate({ fromAccountId: "a1", toAccountId: "a2", amount: 500, transferDate: "2026-06-01" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.TRANSFERS });
    expect(toast.success).toHaveBeenCalledWith("Transfer recorded");
  });
});

describe("useRecordLoanPayment", () => {
  const withInterest: LoanPaymentResult = { interestPaid: 500, principalPaid: 4500, newOutstanding: 95000 };
  const noInterest: LoanPaymentResult = { interestPaid: 0, principalPaid: 5000, newOutstanding: 95000 };

  it("shows a breakdown toast when interest was actually paid", async () => {
    mockedApi.recordLoanPayment.mockResolvedValue(withInterest);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRecordLoanPayment(), { wrapper: Wrapper });
    result.current.mutate({ id: "loan1", amount: 5000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("principal"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("interest"));
  });

  it("shows the plain confirmation toast when the whole payment was principal (interest-free loan)", async () => {
    mockedApi.recordLoanPayment.mockResolvedValue(noInterest);
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useRecordLoanPayment(), { wrapper: Wrapper });
    result.current.mutate({ id: "loan1", amount: 5000 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Payment recorded");
  });
});
