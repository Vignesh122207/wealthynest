import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";

// A merged, chronologically-sortable row for the "All" tab — one of the three transaction kinds,
// tagged so a consumer can narrow on `kind` before touching kind-specific fields on `data`.
export type TxRow =
  | { kind: "expense";  date: string; data: Expense }
  | { kind: "income";   date: string; data: IncomeEntry }
  | { kind: "transfer"; date: string; data: AccountTransfer };
