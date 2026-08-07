"use client";

import {ChevronLeft, ChevronRight, Receipt} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {TableRowSkeleton} from "@/components/shared/LoadingSkeleton";
import {Chip} from "@/features/expenses/components/Chip";
import {cn, formatDate} from "@/lib/utils";
import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";
import type {TxRow} from "./types";
import {AllTransactionRow} from "./AllTransactionRow";

interface AllTabContentProps {
  chips: { label: string; clear: () => void }[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  filteredMergedRows: TxRow[];
  mergedRowsLength: number;
  allTabNet: number;
  fmt: (n: number) => string;
  accountMap: Record<string, string>;
  balanceMap: Map<string, number>;
  activeFilterCount: number;
  search: string;
  onClearFiltersAndSearch: () => void;
  allSortedDates: string[];
  allGrouped: Record<string, TxRow[]>;
  onEditExpense: (e: Expense) => void;
  onEditIncome: (i: IncomeEntry) => void;
  onEditTransfer: (t: AccountTransfer) => void;
  allTotalPages: number;
  allPage: number;
  setAllPage: (updater: (p: number) => number) => void;
  allPageSize: number;
}

// The Transactions page's "All" tab — a single chronological feed merging expenses, income, and
// transfers. Pulled out of the page purely to cut its size; every value here is already
// computed/filtered by the page.
export function AllTabContent({
  chips, isLoading, isError, onRetry, filteredMergedRows, mergedRowsLength, allTabNet, fmt, accountMap, balanceMap,
  activeFilterCount, search, onClearFiltersAndSearch, allSortedDates, allGrouped,
  onEditExpense, onEditIncome, onEditTransfer, allTotalPages, allPage, setAllPage, allPageSize,
}: AllTabContentProps) {
  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">All Transactions</h2>
          <div className="flex items-center gap-3">
            {filteredMergedRows.length > 0 && (
              <span className={cn("text-xs font-bold tabular-nums", allTabNet >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                {allTabNet >= 0 ? "+" : "−"}{fmt(Math.abs(allTabNet))}
              </span>
            )}
            <span className="text-xs text-muted-foreground/80">{filteredMergedRows.length} total</span>
          </div>
        </div>
        {isLoading ? <TableRowSkeleton rows={6} /> :
         isError ? (
          <QueryErrorState onRetry={() => onRetry?.()} description="Couldn't load your transactions. Check your connection and try again." />
        ) :
         filteredMergedRows.length === 0 ? (
          <EmptyState icon={Receipt}
            title={mergedRowsLength === 0 ? "No transactions this period" : "No transactions match your filters"}
            description={
              mergedRowsLength === 0
                ? "Add your first transaction using the button above."
                : "Try clearing the search or filters to see everything again."
            }
            action={
              mergedRowsLength > 0 && (activeFilterCount > 0 || search)
                ? <button onClick={onClearFiltersAndSearch} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                : undefined
            } />
        ) : (
          <div>
            {allSortedDates.map(date => (
              <div key={date}>
                <div className="px-4 py-2 bg-muted/50 border-b border-border/50">
                  <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {allGrouped[date].map(row => (
                    <AllTransactionRow key={`${row.kind}-${row.data.id}`} row={row} accountMap={accountMap} balanceMap={balanceMap}
                      onEditExpense={onEditExpense} onEditIncome={onEditIncome} onEditTransfer={onEditTransfer} />
                  ))}
                </div>
              </div>
            ))}

            {allTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  {allPage * allPageSize + 1}–{Math.min((allPage + 1) * allPageSize, mergedRowsLength)} of {mergedRowsLength}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAllPage(() => 0)} disabled={allPage === 0} aria-label="First page"
                    className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                  <button onClick={() => setAllPage(p => Math.max(0, p - 1))} disabled={allPage === 0} aria-label="Previous page"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-xs text-muted-foreground px-2 tabular-nums">{allPage + 1} / {allTotalPages}</span>
                  <button onClick={() => setAllPage(p => Math.min(allTotalPages - 1, p + 1))} disabled={allPage >= allTotalPages - 1} aria-label="Next page"
                    className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setAllPage(() => allTotalPages - 1)} disabled={allPage >= allTotalPages - 1} aria-label="Last page"
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
