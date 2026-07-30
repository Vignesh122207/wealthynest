import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadAccountStatement } from "./downloadAccountStatement";
import { expensesApi } from "@/features/expenses/api/expenses.api";
import { apiClient } from "@/lib/axios";
import * as reportPdf from "@/lib/pdf/reportPdf";
import type { WalletAccount } from "../types/account.types";
import type { PagedResponse } from "@/types/api.types";

vi.mock("@/features/expenses/api/expenses.api", () => ({
  expensesApi: { getExpenses: vi.fn() },
}));
vi.mock("@/lib/axios", () => ({
  apiClient: { get: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const mockedExpensesApi = vi.mocked(expensesApi);
const mockedApiClient = vi.mocked(apiClient);

const account: WalletAccount = {
  id: "acc-1", accountType: "BANK_ACCOUNT", name: "HDFC Savings",
  openingBalance: 1000, currentBalance: 5000, totalMoneyIn: 8000, totalMoneyOut: 3000,
  recentTransactions: [], createdAt: "2026-01-01",
};

function pagedMeta(totalElements: number): PagedResponse<unknown>["meta"] {
  return { page: 0, size: 500, totalElements, totalPages: totalElements > 0 ? 1 : 0, first: true, last: true };
}

/** expensesApi.getExpenses is mocked directly, so this is exactly the PagedResponse shape the
 * real function resolves to (fetchAllPages reads res.data + res.meta.last off of it). */
function expensesResponse(rows: unknown[]) {
  return { data: rows, meta: pagedMeta(rows.length) } as never;
}

/** apiClient.get is mocked at the axios layer, one level below accountsApi.getTransfers — so this
 * is the axios response envelope ({ data: <body> }) wrapping the real PagedResponse body. */
function transferResponse(rows: { id: string; transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }[]) {
  return { data: { data: rows, meta: pagedMeta(rows.length) } } as never;
}

describe("downloadAccountStatement", () => {
  let addTableCalls: { head: string[]; body: string[][] }[] = [];
  let savedFilename = "";

  beforeEach(() => {
    vi.clearAllMocks();
    addTableCalls = [];
    savedFilename = "";
    mockedExpensesApi.getExpenses.mockResolvedValue(expensesResponse([]));
    mockedApiClient.get.mockResolvedValue(transferResponse([]));

    vi.spyOn(reportPdf, "createReportDoc").mockReturnValue({ doc: {} as never, y: 40 });
    vi.spyOn(reportPdf, "addSummaryCards").mockReturnValue(60);
    vi.spyOn(reportPdf, "addSectionTitle").mockReturnValue(70);
    vi.spyOn(reportPdf, "addTable").mockImplementation((_doc, y, head, body) => {
      addTableCalls.push({ head, body: body as string[][] });
      return y + 10;
    });
    vi.spyOn(reportPdf, "finalizePdf").mockImplementation(async (_doc, filename) => { savedFilename = filename; });
    vi.spyOn(reportPdf, "yieldToMain").mockResolvedValue(undefined);
  });

  it("defaults to all-time — no date bounds, scoped to this account's id", async () => {
    await downloadAccountStatement(account);

    expect(mockedExpensesApi.getExpenses).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: ["acc-1"], page: 0, size: 500, sortDir: "desc" })
    );
    const call = mockedExpensesApi.getExpenses.mock.calls[0][0];
    expect(call).not.toHaveProperty("startDate");
    expect(call).not.toHaveProperty("endDate");
  });

  it("passes Jan 1 – Dec 31 date bounds when a specific year is requested", async () => {
    await downloadAccountStatement(account, 2025);

    expect(mockedExpensesApi.getExpenses).toHaveBeenCalledWith(
      expect.objectContaining({ accountIds: ["acc-1"], startDate: "2025-01-01", endDate: "2025-12-31" })
    );
  });

  it("pages through every expense page instead of stopping at the first", async () => {
    mockedExpensesApi.getExpenses.mockImplementation(async (filters) => {
      const page = filters?.page ?? 0;
      if (page === 0) {
        return { data: [{ id: "e1", expenseDate: "2025-01-01", amount: 100, accountId: "acc-1" }], meta: { page: 0, size: 1, totalElements: 2, totalPages: 2, first: true, last: false } } as never;
      }
      return { data: [{ id: "e2", expenseDate: "2025-01-02", amount: 200, accountId: "acc-1" }], meta: { page: 1, size: 1, totalElements: 2, totalPages: 2, first: false, last: true } } as never;
    });

    await downloadAccountStatement(account, 2025);

    expect(mockedExpensesApi.getExpenses).toHaveBeenCalledTimes(2);
    const expenseTable = addTableCalls.find(c => c.head.includes("Category"));
    expect(expenseTable?.body).toHaveLength(2);
  });

  it("filters transfers to only ones touching this account, and only within the requested year", async () => {
    mockedApiClient.get.mockResolvedValue(transferResponse([
      { id: "t1", transferDate: "2025-03-01", amount: 100, fromAccountId: "acc-1", toAccountId: "acc-2" }, // this account, 2025
      { id: "t2", transferDate: "2024-03-01", amount: 200, fromAccountId: "acc-1", toAccountId: "acc-2" }, // this account, wrong year
      { id: "t3", transferDate: "2025-03-01", amount: 300, fromAccountId: "acc-2", toAccountId: "acc-3" }, // unrelated account
    ]));

    await downloadAccountStatement(account, 2025);

    const transferTable = addTableCalls.find(c => c.head.includes("Description") && c.head.length === 3);
    expect(transferTable?.body).toHaveLength(1);
  });

  it("does not filter transfers by year when 'all' is requested", async () => {
    mockedApiClient.get.mockResolvedValue(transferResponse([
      { id: "t1", transferDate: "2025-03-01", amount: 100, fromAccountId: "acc-1", toAccountId: "acc-2" },
      { id: "t2", transferDate: "2019-03-01", amount: 200, fromAccountId: "acc-1", toAccountId: "acc-2" },
    ]));

    await downloadAccountStatement(account, "all");

    const transferTable = addTableCalls.find(c => c.head.includes("Description") && c.head.length === 3);
    expect(transferTable?.body).toHaveLength(2);
  });

  it("passes free-text expense descriptions through as plain values (jsPDF draws text, it doesn't interpret markup)", async () => {
    mockedExpensesApi.getExpenses.mockResolvedValue(expensesResponse([
      { id: "e1", expenseDate: "2025-01-05", categoryName: "Groceries", description: "<script>alert(1)</script>", amount: 500, accountId: "acc-1" },
    ]));

    await downloadAccountStatement(account, 2025);

    const expenseTable = addTableCalls.find(c => c.head.includes("Category"));
    expect(expenseTable?.body[0]).toContain("<script>alert(1)</script>");
  });

  it("saves the PDF with a filesystem-safe filename derived from the account name", async () => {
    await downloadAccountStatement(account, 2025);

    expect(savedFilename).toBe("WealthyNest-HDFC-Savings-Statement.pdf");
  });

  it("shows a toast instead of throwing when the expenses fetch fails", async () => {
    const { toast } = await import("sonner");
    mockedExpensesApi.getExpenses.mockRejectedValue(new Error("network error"));

    await expect(downloadAccountStatement(account)).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("Failed to generate statement");
    expect(savedFilename).toBe("");
  });
});
