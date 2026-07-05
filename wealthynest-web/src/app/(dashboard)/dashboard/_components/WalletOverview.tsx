"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface WalletOverviewProps {
  totalAccountBalance: number;
  bankBalance:         number;
  cashBalance:         number;
  creditCardDebt:      number;
}

export function WalletOverview({
  totalAccountBalance, bankBalance, cashBalance, creditCardDebt,
}: WalletOverviewProps) {
  const tiles = [
    {
      label: "Total",
      value: totalAccountBalance,
      sub:   "Cash & bank",
      color: "text-foreground",
      bg:    "bg-primary/8 border-primary/15",
    },
    {
      label: "Bank",
      value: bankBalance,
      sub:   "Savings",
      color: "text-violet-600 dark:text-violet-400",
      bg:    "bg-violet-500/8 border-violet-500/15",
    },
    {
      label: "Cash",
      value: cashBalance,
      sub:   "In wallet",
      color: "text-emerald-600 dark:text-emerald-400",
      bg:    "bg-emerald-500/8 border-emerald-500/15",
    },
    ...(creditCardDebt > 0 ? [{
      label: "Card Debt",
      value: creditCardDebt,
      sub:   "Outstanding",
      color: "text-rose-500 dark:text-rose-400",
      bg:    "bg-rose-500/8 border-rose-500/20",
    }] : []),
  ];

  const cols = tiles.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";

  return (
    <Link href="/accounts" className="block group animate-fade-in-up delay-225">
      <div className="bg-gradient-to-r from-primary/8 to-violet-500/6 border border-primary/20 hover:border-primary/35 rounded-2xl p-4 transition-all duration-200 hover:shadow-md hover:shadow-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wallet Overview</p>
          </div>
          <span className="text-xs text-primary font-semibold group-hover:underline transition-colors">
            View all →
          </span>
        </div>
        <div className={cn("grid gap-3", cols)}>
          {tiles.map(({ label, value, sub, color, bg }) => (
            <div key={label} className={cn("rounded-xl p-3 border", bg)}>
              <p className="text-[10px] text-muted-foreground/70 mb-1 uppercase tracking-wide">{label}</p>
              <p className={cn("text-sm font-bold tabular-nums", color)}>{formatCurrency(value)}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}
