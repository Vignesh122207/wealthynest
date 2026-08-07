"use client";

import {memo} from "react";
import {ExpenseRow, IncomeRow, TransferRow} from "@/features/expenses/components/TransactionRows";
import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";
import type {TxRow} from "./types";

interface AllTransactionRowProps {
  row: TxRow;
  accountMap: Record<string, string>;
  balanceMap: Map<string, number>;
  onEditExpense: (e: Expense) => void;
  onEditIncome: (i: IncomeEntry) => void;
  onEditTransfer: (t: AccountTransfer) => void;
}

// One row of the "All" tab's merged feed — delegates to the same row components the Expenses/
// Income/Transfers tabs already use (TransactionRows.tsx), adding only this tab's own running-
// balance line via their shared `balance` prop. Used to duplicate ~100 lines of row markup here;
// a visual/behavior fix to a row (e.g. the DebtBadge treatment) only ever needs making once now.
export const AllTransactionRow = memo(function AllTransactionRow({ row, accountMap, balanceMap, onEditExpense, onEditIncome, onEditTransfer }: AllTransactionRowProps) {
  if (row.kind === "expense") {
    const e = row.data;
    return (
      <ExpenseRow expense={e} accountName={e.accountId ? accountMap[e.accountId] : undefined}
        onEdit={() => onEditExpense(e)}
        balance={e.accountId && balanceMap.has(`expense-${e.id}`) ? balanceMap.get(`expense-${e.id}`) : undefined} />
    );
  }

  if (row.kind === "income") {
    const income = row.data;
    return (
      <IncomeRow entry={income} accountName={income.accountId ? accountMap[income.accountId] : undefined}
        onEdit={() => onEditIncome(income)}
        balance={income.accountId && balanceMap.has(`income-${income.id}`) ? balanceMap.get(`income-${income.id}`) : undefined} />
    );
  }

  const transfer = row.data;
  // A one-sided transfer (debt/adjustment) only ever has the "from" or the "to" side set, never
  // both — show whichever side actually has a balance entry instead of assuming "from" (which
  // left money received back with no balance shown at all, since only toAccountId is set on that leg).
  const balanceKey = balanceMap.has(`transfer-${transfer.id}-from`)
    ? `transfer-${transfer.id}-from`
    : `transfer-${transfer.id}-to`;
  return (
    <TransferRow transfer={transfer} onEdit={() => onEditTransfer(transfer)}
      balance={balanceMap.has(balanceKey) ? balanceMap.get(balanceKey) : undefined} />
  );
});
