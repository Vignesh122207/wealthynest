import type {DebtRecord} from "../types/debt.types";

export interface RecentContact {
  contactName:   string;
  contactPhone?: string;
}

// Purely recency-ordered (unlike groupByContact's overdue-first list) — this feeds the
// create-modal's "Quick pick" chip row, a "who did I just transact with" shortcut rather than a
// triage view, so a contact overdue from months ago shouldn't outrank someone paid yesterday.
// `debts` is assumed already newest-first (the API returns findByUserIdOrderByCreatedAtDesc),
// same assumption groupByContact.ts makes — the first record seen per contact is the most
// recent, so its name casing/phone become the entry's display values.
export function getRecentContacts(debts: DebtRecord[]): RecentContact[] {
  const seen = new Set<string>();
  const list: RecentContact[] = [];
  for (const debt of debts) {
    const key = debt.contactName.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ contactName: debt.contactName, contactPhone: debt.contactPhone });
  }
  return list;
}
