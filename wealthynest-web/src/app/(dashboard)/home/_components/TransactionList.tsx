"use client";

import Link from "next/link";
import {ArrowDownLeft, ArrowUpRight, CreditCard, HandCoins, type LucideIcon, Receipt, RefreshCw,} from "lucide-react";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {getCategoryColor, getCategoryIcon, INCOME_ICON_MAP} from "@/lib/categoryMeta";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {EmptyState} from "@/components/shared/EmptyState";
import type {AccountTransactionItem} from "@/features/accounts/types/account.types";
import {INCOME_SOURCES} from "@/lib/constants";

interface TransactionWithAccount extends AccountTransactionItem {
  accountName: string;
}

interface TransactionListProps {
  transactions: TransactionWithAccount[];
  isLoading:    boolean;
}

const TXN_COLORS: Record<string, string> = {
  INCOME:       "text-emerald-500 dark:text-emerald-400",
  EXPENSE:      "text-red-500 dark:text-red-400",
  TRANSFER_IN:  "text-indigo-500 dark:text-indigo-400",
  TRANSFER_OUT: "text-amber-500 dark:text-amber-400",
  DEBT_OUT:     "text-rose-500 dark:text-rose-400",
  DEBT_IN:      "text-teal-500 dark:text-teal-400",
  ADJUSTMENT:   "text-muted-foreground",
};
const TXN_SIGNS: Record<string, string> = {
  INCOME: "+", EXPENSE: "−", TRANSFER_IN: "+", TRANSFER_OUT: "−",
  DEBT_OUT: "−", DEBT_IN: "+", ADJUSTMENT: "±",
};

const TXN_TRANSFER: Record<string, { icon: LucideIcon; color: string }> = {
  TRANSFER_IN:  { icon: ArrowDownLeft, color: "#818cf8" },
  TRANSFER_OUT: { icon: ArrowUpRight,  color: "#f59e0b" },
  DEBT_OUT:     { icon: CreditCard,    color: "#f43f5e" },
  DEBT_IN:      { icon: HandCoins,     color: "#14b8a6" },
  ADJUSTMENT:   { icon: RefreshCw,     color: "#94a3b8" },
};

function txnLabel(type: string, label: string, description?: string): string {
  if (description) return description;
  if (type === "INCOME") {
    const src = INCOME_SOURCES.find(s => s.value === label);
    return src ? src.label : label;
  }
  return label;
}

function TxnSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-9 rounded-full shimmer shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 rounded-lg shimmer" />
        <div className="h-3 w-24 rounded shimmer" />
      </div>
      <div className="h-4 w-20 rounded-lg shimmer" />
    </div>
  );
}

function TxnIcon({ type, label, categoryIcon, categoryColor }: {
  type: string; label: string; categoryIcon?: string | null; categoryColor?: string | null;
}) {
  // Circular badge here only — PremiumIcon's default rounded-xl/rounded-2xl "glossy tile" shape
  // is the shared system used everywhere else in the app (categories, accounts, goals...); this
  // overrides just the radius for this one list via className, not the shared component itself.
  const ring = "w-9 h-9 rounded-full";

  // INCOME — mapped Lucide icon per source
  if (type === "INCOME") {
    const src = INCOME_ICON_MAP[label] ?? INCOME_ICON_MAP.OTHER;
    return <PremiumIcon icon={src.icon} hex={src.color} size="sm" className={ring} />;
  }

  // EXPENSE — the category's own icon/color first, name-keyword match as fallback
  if (type === "EXPENSE") {
    const icon  = getCategoryIcon({ name: label, icon: categoryIcon });
    const color = getCategoryColor(label, categoryColor ?? undefined);
    return <PremiumIcon icon={icon} hex={color} size="sm" className={ring} />;
  }

  // TRANSFER / DEBT / ADJUSTMENT
  const t    = TXN_TRANSFER[type];
  const Icon = t ? t.icon : RefreshCw;
  const clr  = t ? t.color : "#94a3b8";
  return <PremiumIcon icon={Icon} hex={clr} size="sm" className={ring} />;
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  const { fmt } = useAmountFormatter();
  return (
    <div className="bg-card rounded-2xl border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none overflow-hidden animate-fade-in-up delay-300 flex flex-col h-full card-hover">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40 shrink-0">
        <h2 className="font-bold text-foreground text-sm">Recent Transactions</h2>
        <Link href="/expenses" className="text-xs font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => <TxnSkeleton key={i} />)}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Add your first income or expense to see it here."
          className="flex-1"
        />
      ) : (
        <div className="divide-y divide-border/40">
          {transactions.map((t) => (
            <div key={t.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <TxnIcon type={t.type} label={t.label} categoryIcon={t.categoryIcon} categoryColor={t.categoryColor} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {txnLabel(t.type, t.label, t.description)}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  {formatDate(t.date)}
                  <span className="mx-1.5 text-muted-foreground/80">·</span>
                  <span>{t.accountName}</span>
                </p>
              </div>
              <p className={cn(
                "text-sm font-bold tabular-nums shrink-0",
                TXN_COLORS[t.type] ?? "text-muted-foreground"
              )}>
                {TXN_SIGNS[t.type] ?? ""}{fmt(t.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
