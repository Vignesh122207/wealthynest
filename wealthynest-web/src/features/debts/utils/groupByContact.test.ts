import { describe, it, expect } from "vitest";
import { groupDebtsByContact } from "./groupByContact";
import type { DebtRecord, DebtStatus, DebtType } from "../types/debt.types";

let seq = 0;
function debt(overrides: Partial<DebtRecord> & { contactName: string }): DebtRecord {
  seq += 1;
  const amount = overrides.amount ?? 1000;
  const amountSettled = overrides.amountSettled ?? 0;
  return {
    id: `d${seq}`,
    type: "LENT" as DebtType,
    amount,
    status: "ACTIVE" as DebtStatus,
    amountSettled,
    amountRemaining: amount - amountSettled,
    payments: [],
    createdAt: `2026-01-${String(seq).padStart(2, "0")}T00:00:00Z`,
    ...overrides,
  };
}

describe("groupDebtsByContact", () => {
  it("groups records by normalized (trimmed, lowercased) contactName", () => {
    const groups = groupDebtsByContact([
      debt({ contactName: "Alice" }),
      debt({ contactName: " alice " }),
      debt({ contactName: "ALICE" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(3);
  });

  it("keeps distinct contacts separate", () => {
    const groups = groupDebtsByContact([debt({ contactName: "Alice" }), debt({ contactName: "Bob" })]);
    expect(groups.map(g => g.contactName)).toEqual(["Alice", "Bob"]);
  });

  it("splits a contact's records into active and settled", () => {
    const groups = groupDebtsByContact([
      debt({ contactName: "Alice", status: "ACTIVE" }),
      debt({ contactName: "Alice", status: "SETTLED", amountSettled: 1000, amountRemaining: 0 }),
    ]);
    expect(groups[0].records).toHaveLength(1);
    expect(groups[0].settledRecords).toHaveLength(1);
  });

  it("nets LENT-remaining minus BORROWED-remaining across all of a contact's records", () => {
    const groups = groupDebtsByContact([
      debt({ contactName: "Alice", type: "LENT", amount: 5000, amountSettled: 0, amountRemaining: 5000 }),
      debt({ contactName: "Alice", type: "BORROWED", amount: 2000, amountSettled: 0, amountRemaining: 2000 }),
    ]);
    expect(groups[0].netAmount).toBe(3000);
  });

  it("a settled record contributes zero to netAmount (its remaining is 0)", () => {
    const groups = groupDebtsByContact([
      debt({ contactName: "Alice", type: "LENT", status: "SETTLED", amount: 1000, amountSettled: 1000, amountRemaining: 0 }),
    ]);
    expect(groups[0].netAmount).toBe(0);
  });

  it("uses the first (most recent, since input is newest-first) record's name casing and phone", () => {
    const groups = groupDebtsByContact([
      debt({ contactName: "Alice K", contactPhone: "999" }),
      debt({ contactName: "alice k", contactPhone: "111" }),
    ]);
    expect(groups[0].contactName).toBe("Alice K");
    expect(groups[0].contactPhone).toBe("999");
  });

  it("orders contact groups by first-occurrence (most recent activity first, given newest-first input)", () => {
    const groups = groupDebtsByContact([debt({ contactName: "Bob" }), debt({ contactName: "Alice" })]);
    expect(groups.map(g => g.contactName)).toEqual(["Bob", "Alice"]);
  });

  it("returns an empty array for no debts", () => {
    expect(groupDebtsByContact([])).toEqual([]);
  });
});
