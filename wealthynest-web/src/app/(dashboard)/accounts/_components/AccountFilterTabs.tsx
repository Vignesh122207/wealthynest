"use client";

import { LayoutGrid, Landmark, Wallet, TrendingUp, CreditCard, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WalletAccount } from "@/features/accounts/types/account.types";

export type SectionFilter = "all" | "bank" | "cash" | "cc" | "loan" | "invest";

// Matches ACCOUNT_TYPE_META's own color family per account type — same template as the
// Investments/Transactions/Debts tab bars (solid-fill pill per type, neutral slate for "All").
const SECTION_ACTIVE_BG: Record<SectionFilter, string> = {
  all:    "bg-slate-600",
  bank:   "bg-indigo-600",
  cash:   "bg-emerald-600",
  invest: "bg-cyan-600",
  cc:     "bg-pink-600",
  loan:   "bg-red-600",
};

interface AccountFilterTabsProps {
  accounts: WalletAccount[];
  bankAccounts: WalletAccount[];
  cashAccounts: WalletAccount[];
  emergencyAccounts: WalletAccount[];
  investAccounts: WalletAccount[];
  creditCards: WalletAccount[];
  loanAccounts: WalletAccount[];
  sectionFilter: SectionFilter;
  setSectionFilter: (f: SectionFilter) => void;
}

// Filter tabs — same template as the Investments page's tab bar: solid-fill pills colored per
// account type (matching ACCOUNT_TYPE_META), with a count badge, horizontally scrollable with a
// hidden scrollbar.
export function AccountFilterTabs({
  accounts, bankAccounts, cashAccounts, emergencyAccounts, investAccounts, creditCards, loanAccounts,
  sectionFilter, setSectionFilter,
}: AccountFilterTabsProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="flex gap-1 overflow-x-auto animate-fade-in-up" style={{ scrollbarWidth: "none" }}>
      {([
        { key: "all",    label: "All",              icon: LayoutGrid, count: accounts.length },
        { key: "bank",   label: "Bank",              icon: Landmark,   count: bankAccounts.length },
        { key: "cash",   label: "Cash & Emergency",  icon: Wallet,     count: cashAccounts.length + emergencyAccounts.length },
        { key: "invest", label: "Investments",       icon: TrendingUp, count: investAccounts.length },
        { key: "cc",     label: "Credit Cards",      icon: CreditCard, count: creditCards.length },
        { key: "loan",   label: "Loans",             icon: HandCoins,  count: loanAccounts.length },
      ] as const).map(t => (
        <button key={t.key} onClick={() => setSectionFilter(t.key)}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
            sectionFilter === t.key ? cn(SECTION_ACTIVE_BG[t.key], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}>
          <t.icon className="w-3.5 h-3.5" />
          {t.label}
          {t.key !== "all" && t.count > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
              sectionFilter === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
