"use client";

import Link from "next/link";
import {Wallet} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";

interface WalletOverviewProps {
  accounts:  WalletAccount[];
  isLoading: boolean;
}

const TYPE_ORDER: AccountType[] = ["BANK_ACCOUNT", "CASH_WALLET", "CREDIT_CARD", "LOAN"];

const GROUP_LABEL: Record<AccountType, string> = {
  BANK_ACCOUNT: "Bank Accounts",
  CASH_WALLET:  "Cash Wallets",
  CREDIT_CARD:  "Credit Cards",
  LOAN:         "Loans",
};

// Local-midnight-to-local-midnight, not raw Date.now() — same fix SmartAlerts.tsx already applies
// to its own due-date math (see that file's comment): diffing against the exact current instant
// instead of today's midnight makes the result drift by up to a day depending purely on what time
// of day it is, so "due in 2 days" could flip to "due in 1 day" a few hours later with no actual
// date having changed.
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const due   = new Date(dateStr);
  const today = new Date();
  const dueMidnight   = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((dueMidnight - todayMidnight) / 86_400_000);
}

export function WalletOverview({ accounts, isLoading }: WalletOverviewProps) {
  const { fmt } = useAmountFormatter();
  // Matches accounts/page.tsx's own activeAccounts filter exactly — CLOSED is pulled out of the
  // main total there too (a real-world closed account, not just archived from view), so this
  // widget's Total Balance agrees with the Accounts page instead of quietly including it.
  const active = accounts.filter(a => a.status === "ACTIVE");

  // Total balance = everything the user actually owns (cash + bank, purpose-tagged or not) —
  // credit cards and loans are liabilities, not counted here.
  const totalBalance = active
    .filter(a => a.accountType !== "CREDIT_CARD" && a.accountType !== "LOAN")
    .reduce((s, a) => s + a.currentBalance, 0);

  // Grouped by type rather than listed per-account so the widget stays a fixed
  // height (≤6 rows) regardless of how many accounts a family accumulates.
  const groups = TYPE_ORDER
    .map((type) => {
      const inType = active.filter(a => a.accountType === type);
      if (inType.length === 0) return null;

      const isCard = type === "CREDIT_CARD";
      const total = inType.reduce((s, a) => s + (isCard ? Math.max(0, a.currentBalance) : a.currentBalance), 0);

      const soonestDue = isCard
        ? inType
            .map(a => daysUntil(a.nextDueDate))
            .filter((d): d is number => d != null)
            .sort((a, b) => a - b)[0] ?? null
        : null;

      return { type, meta: ACCOUNT_TYPE_META[type], count: inType.length, total, soonestDue, isCard };
    })
    .filter((g): g is NonNullable<typeof g> => g != null);

  return (
    <div className="bg-card rounded-xl shadow-soft dark:shadow-none dark:border dark:border-border/50 p-4 h-full flex flex-col card-hover">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-foreground text-sm">Accounts Overview</h2>
        </div>
        <Link href="/accounts" className="text-[11px] font-semibold text-primary hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-4">
          <div className="h-[68px] rounded-xl shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl shimmer shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 rounded shimmer" />
                  <div className="h-3 w-16 rounded shimmer" />
                </div>
                <div className="h-3.5 w-16 rounded shimmer" />
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      <div className="mt-2 mb-3 p-3 rounded-xl bg-primary/8 border border-primary/15">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mb-1">Total Balance</p>
        <p className="text-xl font-bold text-foreground tabular-nums">{fmt(totalBalance)}</p>
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">Cash &amp; bank accounts combined</p>
      </div>

      <div className="flex-1 divide-y divide-border/40">
        {groups.map((g) => {
          const urgent = g.soonestDue != null && g.soonestDue <= 5;

          return (
            <Link key={g.type} href="/accounts" className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 group">
              <PremiumIcon icon={g.meta.icon} hex={g.meta.hex} size="sm" className="w-9 h-9" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {GROUP_LABEL[g.type]}
                </p>
                <p className={cn(
                  "text-[11px] truncate",
                  urgent ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/70"
                )}>
                  {urgent && `Due ${g.soonestDue! <= 0 ? "today" : `in ${g.soonestDue}d`} · `}
                  {g.count} {g.count === 1 ? "account" : "accounts"}
                </p>
              </div>
              <p className={cn("text-sm font-bold tabular-nums shrink-0", g.isCard && g.total > 0 ? "text-rose-500 dark:text-rose-400" : "text-foreground")}>
                {g.isCard && g.total > 0 ? "−" : ""}{fmt(g.total)}
              </p>
            </Link>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
