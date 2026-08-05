"use client";

import {CreditCard, HandCoins, Landmark, LayoutGrid, Wallet} from "lucide-react";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import type {WalletAccount} from "@/features/accounts/types/account.types";

export type SectionFilter = "all" | "bank" | "cash" | "cc" | "loan";

// Matches ACCOUNT_TYPE_META's own color family per account type — same template as the
// Investments/Transactions/Debts tab bars, neutral slate for "All".
const SECTION_COLOR: Record<SectionFilter, string> = {
  all:  "#475569",
  bank: "#4f46e5",
  cash: "#059669",
  cc:   "#db2777",
  loan: "#dc2626",
};

interface AccountFilterTabsProps {
  accounts: WalletAccount[];
  bankAccounts: WalletAccount[];
  cashAccounts: WalletAccount[];
  creditCards: WalletAccount[];
  loanAccounts: WalletAccount[];
  sectionFilter: SectionFilter;
  setSectionFilter: (f: SectionFilter) => void;
}

// Filter tabs — shared TabBar template (segmented rail, colored icons, sliding gradient
// indicator) used the same way across Investments/Transactions/Debts/etc.
export function AccountFilterTabs({
  accounts, bankAccounts, cashAccounts, creditCards, loanAccounts,
  sectionFilter, setSectionFilter,
}: AccountFilterTabsProps) {
  if (accounts.length === 0) return null;

  const items: TabBarItem<SectionFilter>[] = [
    { key: "all",  label: "All",           icon: LayoutGrid, color: SECTION_COLOR.all },
    { key: "bank", label: "Bank",           icon: Landmark,   color: SECTION_COLOR.bank, count: bankAccounts.length },
    { key: "cash", label: "Cash Wallet",    icon: Wallet,     color: SECTION_COLOR.cash, count: cashAccounts.length },
    { key: "cc",   label: "Credit Cards",   icon: CreditCard, color: SECTION_COLOR.cc,   count: creditCards.length },
    { key: "loan", label: "Loans",          icon: HandCoins,  color: SECTION_COLOR.loan, count: loanAccounts.length },
  ];

  return (
    <TabBar items={items} value={sectionFilter} onChange={setSectionFilter}
      className="animate-fade-in-up" testIdPrefix="account-filter" />
  );
}
