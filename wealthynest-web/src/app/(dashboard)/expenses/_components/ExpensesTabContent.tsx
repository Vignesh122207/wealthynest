"use client";

import {ChevronLeft, ChevronRight, Plus, Receipt} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {TableRowSkeleton} from "@/components/shared/LoadingSkeleton";
import {ExpenseRow} from "@/features/expenses/components/TransactionRows";
import {Chip} from "@/features/expenses/components/Chip";
import {formatDate} from "@/lib/utils";
import type {Expense} from "@/features/expenses/types/expense.types";

interface ExpensesTabContentProps {
  chips: { label: string; clear: () => void }[];
  expensesLoading: boolean;
  expensesError?: boolean;
  onRetryExpenses?: () => void;
  expenses: Expense[];
  hasAccounts: boolean;
  activeFilterCount: number;
  addAccountCta: React.ReactNode;
  clearAllFilters: () => void;
  onAddExpense: () => void;
  expenseTabTotal: number;
  expenseTabRowCount: number;
  sortedDates: string[];
  grouped: Record<string, Expense[]>;
  fmt: (n: number) => string;
  accountMap: Record<string, string>;
  onEditExpense: (e: Expense) => void;
  totalPages: number;
  listPage: number;
  setListPage: (updater: (p: number) => number) => void;
  serverTotal: number;
  pageSize: number;
}

// The Transactions page's Expenses tab — all list rendering, pulled out of the page purely to
// cut its size. Every value here is already computed/filtered by the page; this just renders it.
export function ExpensesTabContent({
  chips, expensesLoading, expensesError, onRetryExpenses, expenses, hasAccounts, activeFilterCount, addAccountCta, clearAllFilters,
  onAddExpense, expenseTabTotal, expenseTabRowCount, sortedDates, grouped, fmt, accountMap,
  onEditExpense, totalPages, listPage, setListPage, serverTotal, pageSize,
}: ExpensesTabContentProps) {
  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Expenses</h3>
          <div className="flex items-center gap-3">
            {expenseTabTotal > 0 && <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(expenseTabTotal)}</span>}
            <span className="text-xs text-muted-foreground/80">{expenseTabRowCount} total</span>
          </div>
        </div>
        {expensesLoading ? <TableRowSkeleton rows={6} /> : expensesError ? (
          <QueryErrorState onRetry={() => onRetryExpenses?.()} description="Couldn't load your expenses. Check your connection and try again." />
        ) : expenses.length === 0 ? (
          <EmptyState icon={Receipt} title={!hasAccounts ? "No accounts yet" : "No expenses found"}
            description={
              !hasAccounts ? "Add a bank, cash, or credit account before logging expenses."
                : activeFilterCount > 0 ? "No expenses match the active filters." : "Track your spending by adding your first expense."
            }
            action={
              !hasAccounts ? addAccountCta
                : activeFilterCount > 0
                ? <button onClick={clearAllFilters} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                : <button onClick={onAddExpense}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Add Expense
                  </button>
            } />
        ) : (
          <div>
            {sortedDates.map(date => {
              const dayTotal = grouped[date].reduce((s, e) => s + e.amount, 0);
              return (
                <div key={date}>
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                    <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                    <span className="text-xs font-semibold text-red-500/70 tabular-nums">−{fmt(dayTotal)}</span>
                  </div>
                  <div className="divide-y divide-border/50">
                    {grouped[date].map(expense => (
                      <ExpenseRow key={expense.id} expense={expense}
                        accountName={expense.accountId ? accountMap[expense.accountId] : undefined}
                        onEdit={() => onEditExpense(expense)} />
                    ))}
                  </div>
                </div>
              );
            })}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  {listPage * pageSize + 1}–{Math.min((listPage + 1) * pageSize, serverTotal)} of {serverTotal}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setListPage(() => 0)} disabled={listPage === 0} aria-label="First page"
                    className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                  <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={listPage === 0} aria-label="Previous page"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-xs text-muted-foreground px-2 tabular-nums">{listPage + 1} / {totalPages}</span>
                  <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={listPage >= totalPages - 1} aria-label="Next page"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setListPage(() => totalPages - 1)} disabled={listPage >= totalPages - 1} aria-label="Last page"
                    className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">»</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
