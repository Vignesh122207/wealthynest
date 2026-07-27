import {ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Receipt} from "lucide-react";
import {TabBar, type TabBarItem} from "@/components/ui/TabBar";
import type {TxType} from "../types/filters.types";

// Matches this page's own FAB action colors (Add Expense=rose, Add Income=emerald,
// Transfer=indigo) — same per-type template as Investments/Accounts/Debts.
const TAB_COLOR: Record<TxType, string> = {
  all:       "#475569",
  expenses:  "#e11d48",
  income:    "#059669",
  transfers: "#4f46e5",
};

export function TypeTabs({ value, onChange, counts }: {
  value: TxType; onChange: (t: TxType) => void;
  counts: Record<TxType, number>;
}) {
  const items: TabBarItem<TxType>[] = [
    { key: "all",       label: "All",       icon: Receipt,        color: TAB_COLOR.all },
    { key: "expenses",  label: "Expenses",  icon: ArrowDownLeft,  color: TAB_COLOR.expenses,  count: counts.expenses },
    { key: "income",    label: "Income",    icon: ArrowUpRight,   color: TAB_COLOR.income,    count: counts.income },
    { key: "transfers", label: "Transfers", icon: ArrowLeftRight, color: TAB_COLOR.transfers, count: counts.transfers },
  ];
  return <TabBar items={items} value={value} onChange={onChange} testIdPrefix="type-tab" />;
}
