"use client";

import Link from "next/link";
import {
  Receipt, ArrowDownLeft, ArrowUpRight, CreditCard, HandCoins, RefreshCw,
  Briefcase, Laptop, Building2, Home, Gift, Percent, TrendingUp, Coins,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryMeta } from "@/lib/categoryMeta";
import type { AccountTransactionItem } from "@/features/accounts/types/account.types";
import { INCOME_SOURCES } from "@/lib/constants";

interface TransactionWithAccount extends AccountTransactionItem {
  accountName: string;
}

interface TransactionListProps {
  transactions: TransactionWithAccount[];
  isLoading:    boolean;
}

// Income source → Lucide icon + color
const INCOME_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  SALARY:    { icon: Briefcase,  color: "#34C759" },
  FREELANCE: { icon: Laptop,     color: "#007AFF" },
  BUSINESS:  { icon: Building2,  color: "#BF5AF2" },
  RENTAL:    { icon: Home,       color: "#30B0C7" },
  BONUS:     { icon: Gift,       color: "#FF9500" },
  INTEREST:  { icon: Percent,    color: "#5AC8FA" },
  DIVIDEND:  { icon: TrendingUp, color: "#32D74B" },
  OTHER:     { icon: Coins,      color: "#8E8E93" },
};

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

const TXN_TRANSFER: Record<string, { icon: LucideIcon; bg: string; color: string }> = {
  TRANSFER_IN:  { icon: ArrowDownLeft, bg: "#818cf820", color: "#818cf8" },
  TRANSFER_OUT: { icon: ArrowUpRight,  bg: "#f59e0b20", color: "#f59e0b" },
  DEBT_OUT:     { icon: CreditCard,    bg: "#f43f5e20", color: "#f43f5e" },
  DEBT_IN:      { icon: HandCoins,     bg: "#14b8a620", color: "#14b8a6" },
  ADJUSTMENT:   { icon: RefreshCw,     bg: "#94a3b820", color: "#94a3b8" },
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
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-9 h-9 rounded-xl shimmer shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-40 rounded-lg shimmer" />
        <div className="h-3 w-24 rounded shimmer" />
      </div>
      <div className="h-4 w-20 rounded-lg shimmer" />
    </div>
  );
}

function TxnIcon({ type, label }: { type: string; label: string }) {
  // INCOME — mapped Lucide icon per source
  if (type === "INCOME") {
    const src   = INCOME_ICON_MAP[label] ?? INCOME_ICON_MAP.OTHER;
    const Icon  = src.icon;
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: src.color + "20" }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: src.color }} strokeWidth={1.75} />
      </div>
    );
  }

  // EXPENSE — category-matched Lucide icon + color
  if (type === "EXPENSE") {
    const meta = getCategoryMeta(label);
    const Icon = meta.icon;
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: meta.color + "20" }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: meta.color }} strokeWidth={1.75} />
      </div>
    );
  }

  // TRANSFER / DEBT / ADJUSTMENT
  const t    = TXN_TRANSFER[type];
  const Icon = t ? t.icon : RefreshCw;
  const bg   = t ? t.bg   : "#94a3b820";
  const clr  = t ? t.color : "#94a3b8";
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: bg }}>
      <Icon className="w-[18px] h-[18px]" style={{ color: clr }} strokeWidth={1.75} />
    </div>
  );
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm animate-fade-in-up delay-300 flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
        <h3 className="font-bold text-foreground">Recent Transactions</h3>
        <Link href="/expenses" className="text-xs font-semibold text-primary hover:underline transition-colors">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => <TxnSkeleton key={i} />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center flex-1">
          <Receipt className="w-10 h-10 text-muted-foreground/25 mb-1" />
          <p className="text-sm font-medium text-foreground">No transactions yet</p>
          <p className="text-xs text-muted-foreground">Add your first income or expense</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {transactions.map((t) => (
            <div key={t.id}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <TxnIcon type={t.type} label={t.label} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {txnLabel(t.type, t.label, t.description)}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {formatDate(t.date)}
                  <span className="mx-1.5 text-muted-foreground/25">·</span>
                  <span>{t.accountName}</span>
                </p>
              </div>
              <p className={cn(
                "text-sm font-bold tabular-nums shrink-0",
                TXN_COLORS[t.type] ?? "text-muted-foreground"
              )}>
                {TXN_SIGNS[t.type] ?? ""}{formatCurrency(t.amount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
