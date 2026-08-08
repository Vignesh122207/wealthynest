import { describe, it, expect } from "vitest";
import { getRecentContacts } from "./recentContacts";
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

describe("getRecentContacts", () => {
  it("dedupes by normalized (trimmed, lowercased) contactName", () => {
    const list = getRecentContacts([
      debt({ contactName: "Alice" }),
      debt({ contactName: " alice " }),
      debt({ contactName: "ALICE" }),
    ]);
    expect(list).toHaveLength(1);
  });

  it("keeps insertion order (recency), not overdue status — unlike groupByContact's ordering", () => {
    const list = getRecentContacts([
      debt({ contactName: "Bob" }),
      debt({ contactName: "Alice", dueDate: "2020-01-01" }), // overdue, but listed second
    ]);
    expect(list.map(c => c.contactName)).toEqual(["Bob", "Alice"]);
  });

  it("uses the first (most recent, given newest-first input) record's name casing and phone", () => {
    const list = getRecentContacts([
      debt({ contactName: "Alice K", contactPhone: "999" }),
      debt({ contactName: "alice k", contactPhone: "111" }),
    ]);
    expect(list[0].contactName).toBe("Alice K");
    expect(list[0].contactPhone).toBe("999");
  });

  it("returns an empty array for no debts", () => {
    expect(getRecentContacts([])).toEqual([]);
  });
});
