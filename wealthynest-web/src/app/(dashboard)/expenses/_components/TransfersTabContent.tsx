"use client";

import {ArrowLeftRight, Plus} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {TableRowSkeleton} from "@/components/shared/LoadingSkeleton";
import {TransferRow} from "@/features/expenses/components/TransactionRows";
import {Chip} from "@/features/expenses/components/Chip";
import {formatDate} from "@/lib/utils";
import type {AccountTransfer} from "@/features/accounts/types/account.types";

interface TransfersTabContentProps {
  chips: { label: string; clear: () => void }[];
  transfersLoading: boolean;
  transfersError?: boolean;
  onRetryTransfers?: () => void;
  searchedTransfers: AccountTransfer[];
  hasTwoAccounts: boolean;
  addAccountCta: React.ReactNode;
  onAddTransfer: () => void;
  transferSortedDates: string[];
  transferGrouped: Record<string, AccountTransfer[]>;
  fmt: (n: number) => string;
  onEditTransfer: (transfer: AccountTransfer) => void;
}

export function TransfersTabContent({
  chips, transfersLoading, transfersError, onRetryTransfers, searchedTransfers, hasTwoAccounts, addAccountCta, onAddTransfer,
  transferSortedDates, transferGrouped, fmt, onEditTransfer,
}: TransfersTabContentProps) {
  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Transfers</h2>
          <div className="flex items-center gap-3">
            {searchedTransfers.length > 0 && (
              <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 tabular-nums">
                {fmt(searchedTransfers.reduce((s, t) => s + t.amount, 0))}
              </span>
            )}
            <span className="text-xs text-muted-foreground/80">{searchedTransfers.length} total</span>
          </div>
        </div>
        {transfersLoading ? <TableRowSkeleton rows={4} /> : transfersError ? (
          <QueryErrorState onRetry={() => onRetryTransfers?.()} description="Couldn't load your transfers. Check your connection and try again." />
        ) : searchedTransfers.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title={!hasTwoAccounts ? "Need at least 2 accounts" : "No transfers this period"}
            description={!hasTwoAccounts ? "Transfers move money between two of your own accounts — add another account first." : "Move money between your accounts."}
            action={
              !hasTwoAccounts ? addAccountCta
                : <button onClick={onAddTransfer}
                className="flex items-center gap-2 bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> New Transfer
              </button>
            } />
        ) : (
          <div>
            {transferSortedDates.map(date => (
              <div key={date}>
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                  <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                  <span className="text-xs font-semibold text-indigo-500/70 tabular-nums">
                    {fmt(transferGrouped[date].reduce((s, t) => s + t.amount, 0))}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {transferGrouped[date].map(transfer => (
                    <TransferRow key={transfer.id} transfer={transfer}
                      onEdit={() => onEditTransfer(transfer)} />
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
