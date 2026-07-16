import { Receipt, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TxType } from "../types/filters.types";

// Matches this page's own FAB action colors (Add Expense=rose, Add Income=emerald,
// Transfer=indigo) — same per-type solid-fill template as Investments/Accounts/Debts.
const TAB_ACTIVE_BG: Record<TxType, string> = {
  all:       "bg-slate-600",
  expenses:  "bg-rose-600",
  income:    "bg-emerald-600",
  transfers: "bg-indigo-600",
};

export function TypeTabs({ value, onChange, counts }: {
  value: TxType; onChange: (t: TxType) => void;
  counts: Record<TxType, number>;
}) {
  const tabs: { key: TxType; label: string; icon: React.ReactNode }[] = [
    { key: "all",       label: "All",       icon: <Receipt className="w-3.5 h-3.5" /> },
    { key: "expenses",  label: "Expenses",  icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
    { key: "income",    label: "Income",    icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
    { key: "transfers", label: "Transfers", icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
            value === t.key ? cn(TAB_ACTIVE_BG[t.key], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}>
          {t.icon} {t.label}
          {t.key !== "all" && counts[t.key] > 0 && (
            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
              value === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
              {counts[t.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
