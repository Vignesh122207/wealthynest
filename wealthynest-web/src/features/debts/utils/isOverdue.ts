import type {DebtRecord} from "../types/debt.types";

// Shared by DebtTransactionRow (per-transaction "Overdue" label) and groupByContact (per-contact
// alert dot) — both need the exact same predicate, so it lives in one place rather than two
// inline date comparisons quietly drifting apart.
export function isDebtOverdue(debt: Pick<DebtRecord, "dueDate" | "status">): boolean {
  return !!debt.dueDate && new Date(debt.dueDate) < new Date() && debt.status !== "SETTLED";
}
