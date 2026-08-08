import type {DebtRecord} from "../types/debt.types";
import {isDebtOverdue} from "./isOverdue";

export interface ContactGroup {
  key:            string;
  contactName:    string;
  contactPhone?:  string;
  records:        DebtRecord[];
  settledRecords: DebtRecord[];
  netAmount:      number;
  lastActivityAt: string;
  hasOverdue:     boolean;
}

// Groups DebtRecords by contact so repeat transactions with the same person land on one ledger
// card instead of N disconnected ones — no dedicated Contact entity yet, just a normalized
// (trimmed, lowercased) contactName as the grouping key. `debts` is assumed already sorted
// newest-first (the API returns findByUserIdOrderByCreatedAtDesc), so the first record seen per
// group is the most recent — its casing/phone become the group's display values, and Map
// insertion order naturally sorts contacts by their own most recent activity, EXCEPT that a
// contact with an overdue payment is bumped to the front — that's the one thing worth seeing
// before scrolling, regardless of how long ago you last transacted with them.
export function groupDebtsByContact(debts: DebtRecord[]): ContactGroup[] {
  const groups = new Map<string, ContactGroup>();

  for (const debt of debts) {
    const key = debt.contactName.trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        key, contactName: debt.contactName, contactPhone: debt.contactPhone,
        records: [], settledRecords: [], netAmount: 0, lastActivityAt: debt.createdAt, hasOverdue: false,
      };
      groups.set(key, group);
    }

    if (debt.status === "SETTLED") group.settledRecords.push(debt);
    else group.records.push(debt);

    // Remaining, not total amount — a partially paid debt should only count what's still owed.
    group.netAmount += (debt.type === "LENT" ? 1 : -1) * debt.amountRemaining;
    if (isDebtOverdue(debt)) group.hasOverdue = true;
  }

  // Stable sort: ties (the common case — nobody or everybody overdue) keep the insertion order above.
  return [...groups.values()].sort((a, b) => Number(b.hasOverdue) - Number(a.hasOverdue));
}
