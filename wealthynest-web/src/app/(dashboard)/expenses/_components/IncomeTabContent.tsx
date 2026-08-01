"use client";

import {ArrowUpRight, Plus} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {TableRowSkeleton} from "@/components/shared/LoadingSkeleton";
import {IncomeRow} from "@/features/expenses/components/TransactionRows";
import {Chip} from "@/features/expenses/components/Chip";
import {formatDate} from "@/lib/utils";
import type {IncomeEntry} from "@/features/income/types/income.types";

interface IncomeTabContentProps {
  chips: { label: string; clear: () => void }[];
  incomeLoading: boolean;
  incomeError?: boolean;
  onRetryIncome?: () => void;
  searchedIncome: IncomeEntry[];
  hasIncomeAccounts: boolean;
  addAccountCta: React.ReactNode;
  onAddIncome: () => void;
  incomeSortedDates: string[];
  incomeGrouped: Record<string, IncomeEntry[]>;
  fmt: (n: number) => string;
  accountMap: Record<string, string>;
  onEditIncome: (entry: IncomeEntry) => void;
}

export function IncomeTabContent({
  chips, incomeLoading, incomeError, onRetryIncome, searchedIncome, hasIncomeAccounts, addAccountCta, onAddIncome,
  incomeSortedDates, incomeGrouped, fmt, accountMap, onEditIncome,
}: IncomeTabContentProps) {
  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Income</h2>
          <div className="flex items-center gap-3">
            {searchedIncome.length > 0 && (
              <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                +{fmt(searchedIncome.reduce((s, i) => s + i.amount, 0))}
              </span>
            )}
            <span className="text-xs text-muted-foreground/80">{searchedIncome.length} total</span>
          </div>
        </div>
        {incomeLoading ? <TableRowSkeleton rows={4} /> : incomeError ? (
          <QueryErrorState onRetry={() => onRetryIncome?.()} description="Couldn't load your income. Check your connection and try again." />
        ) : searchedIncome.length === 0 ? (
          <EmptyState icon={ArrowUpRight}
            title={!hasIncomeAccounts ? "No accounts yet" : chips.length > 0 ? "No income matches your filters" : "No income this period"}
            description={!hasIncomeAccounts ? "Add a bank or cash account before recording income."
              : chips.length > 0 ? "Try clearing the filters to see everything again." : "Record income to track what's coming in."}
            action={
              !hasIncomeAccounts ? addAccountCta
                : chips.length > 0
                ? <button onClick={() => chips.forEach(c => c.clear())} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                : <button onClick={onAddIncome}
                className="flex items-center gap-2 bg-gradient-to-br from-emerald-700 to-emerald-600 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add Income
              </button>
            } />
        ) : (
          <div>
            {incomeSortedDates.map(date => (
              <div key={date}>
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                  <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                  <span className="text-xs font-semibold text-emerald-500/80 tabular-nums">
                    +{fmt(incomeGrouped[date].reduce((s, i) => s + i.amount, 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {incomeGrouped[date].map(entry => (
                    <IncomeRow key={entry.id} entry={entry}
                      accountName={entry.accountId ? accountMap[entry.accountId] : undefined}
                      onEdit={() => onEditIncome(entry)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
