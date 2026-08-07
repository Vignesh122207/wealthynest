import type {DebtRecord} from "../types/debt.types";

export interface ContactGroup {
  key:            string;
  contactName:    string;
  contactPhone?:  string;
  records:        DebtRecord[];
  settledRecords: DebtRecord[];
  netAmount:      number;
  lastActivityAt: string;
}

// Groups DebtRecords by contact so repeat transactions with the same person land on one ledger
// card instead of N disconnected ones — no dedicated Contact entity yet, just a normalized
// (trimmed, lowercased) contactName as the grouping key. `debts` is assumed already sorted
// newest-first (the API returns findByUserIdOrderByCreatedAtDesc), so the first record seen per
// group is the most recent — its casing/phone become the group's display values, and Map
// insertion order naturally sorts contacts by their own most recent activity.
export function groupDebtsByContact(debts: DebtRecord[]): ContactGroup[] {
  const groups = new Map<string, ContactGroup>();

  for (const debt of debts) {
    const key = debt.contactName.trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        key, contactName: debt.contactName, contactPhone: debt.contactPhone,
        records: [], settledRecords: [], netAmount: 0, lastActivityAt: debt.createdAt,
      };
      groups.set(key, group);
    }

    if (debt.status === "SETTLED") group.settledRecords.push(debt);
    else group.records.push(debt);

    // Remaining, not total amount — a partially paid debt should only count what's still owed.
    group.netAmount += (debt.type === "LENT" ? 1 : -1) * debt.amountRemaining;
  }

  return [...groups.values()];
}
