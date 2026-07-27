import {describe, it, expect, vi, beforeEach, afterEach} from "vitest";
import {exportCsv} from "./csvExport";
import type {Expense} from "@/features/expenses/types/expense.types";

function baseExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1", userId: "u1", categoryId: "c1", amount: 100, currency: "INR",
    expenseDate: "2026-07-01", recurring: false, debt: false, createdAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("exportCsv", () => {
  let capturedCsv = "";

  beforeEach(() => {
    capturedCsv = "";
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document.body, "appendChild").mockImplementation((n) => n);
    vi.spyOn(document.body, "removeChild").mockImplementation((n) => n);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    class MockBlob {
      constructor(parts: BlobPart[] = []) {
        capturedCsv = parts.join("");
      }
    }
    vi.stubGlobal("Blob", MockBlob);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("humanizes a raw backend paymentMethod enum instead of exporting it verbatim", () => {
    exportCsv([baseExpense({paymentMethod: "BANK_ACCOUNT"})], "2026-07", {}, {});

    expect(capturedCsv).toContain("Bank Account");
    expect(capturedCsv).not.toContain("BANK_ACCOUNT");
  });

  it("falls back to the account-type-derived label when paymentMethod is absent", () => {
    exportCsv(
      [baseExpense({accountId: "a1"})],
      "2026-07",
      {a1: "HDFC Savings"},
      {a1: "CASH_WALLET"},
    );

    expect(capturedCsv).toContain("Cash");
  });

  it("leaves an unrecognized paymentMethod value as-is rather than dropping it", () => {
    exportCsv([baseExpense({paymentMethod: "UPI"})], "2026-07", {}, {});

    expect(capturedCsv).toContain("UPI");
  });
});
