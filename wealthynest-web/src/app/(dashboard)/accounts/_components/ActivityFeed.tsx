"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Filter, ArrowLeftRight, Activity,
  Pencil, Trash2,
  Briefcase, Laptop, Building2, Home, Gift, Percent, TrendingUp, Coins,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { getCategoryMeta } from "@/lib/categoryMeta";
import { INCOME_SOURCES } from "@/lib/constants";
import type { WalletAccount, AccountTransfer } from "@/features/accounts/types/account.types";
import type { IncomeEntry } from "@/features/income/types/income.types";
import type { Expense } from "@/features/expenses/types/expense.types";

type TxnRef = { id: string; amount: number; description?: string; date: string };
type FeedKind = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER";

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

interface ActivityFeedProps {
  transfers:        AccountTransfer[];
  incomes:          IncomeEntry[];
  expenses:         Expense[];
  accounts:         WalletAccount[];
  onEditIncome:     (txn: TxnRef) => void;
  onDeleteIncome:   (id: string) => void;
  onEditExpense:    (txn: TxnRef) => void;
  onDeleteExpense:  (id: string) => void;
  onEditTransfer:   (txn: TxnRef) => void;
  onDeleteTransfer: (id: string) => void;
}

type ActivityItem =
  | { kind: "income";   date: string; id: string; source: string; amount: number; description?: string; accountName?: string }
  | { kind: "expense";  date: string; id: string; categoryName: string; color?: string; amount: number; description?: string; accountName?: string }
  | { kind: "transfer"; date: string; id: string; from: string; to: string; amount: number; description?: string };

export function ActivityFeed({
  transfers, incomes, expenses, accounts,
  onEditIncome, onDeleteIncome, onEditExpense, onDeleteExpense, onEditTransfer, onDeleteTransfer,
}: ActivityFeedProps) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [kind,      setKind]      = useState<FeedKind>("ALL");
  const [srcFilter, setSrcFilter] = useState("ALL");

  const accountMap = useMemo(
    () => Object.fromEntries(accounts.map(a => [a.id, a.name])),
    [accounts],
  );

  const allItems = useMemo<ActivityItem[]>(() => [
    ...incomes.map(i => ({
      kind: "income" as const, date: i.incomeDate, id: i.id,
      source: i.source, amount: i.amount, description: i.description,
      accountName: i.accountId ? accountMap[i.accountId] : undefined,
    })),
    ...expenses.map(e => ({
      kind: "expense" as const, date: e.expenseDate, id: e.id,
      categoryName: e.categoryName ?? "Expense", color: e.categoryColor,
      amount: e.amount, description: e.description,
      accountName: e.accountId ? accountMap[e.accountId] : undefined,
    })),
    ...transfers.map(t => ({
      kind: "transfer" as const, date: t.transferDate, id: t.id,
      from: t.fromAccountName, to: t.toAccountName,
      amount: t.amount, description: t.description,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [incomes, expenses, transfers, accountMap]);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = viewMonth + dir, y = viewYear;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setViewMonth(m); setViewYear(y);
  };

  const label = new Date(viewYear, viewMonth - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const filtered = useMemo(() => allItems.filter(item => {
    const d = new Date(item.date);
    if (d.getFullYear() !== viewYear || d.getMonth() + 1 !== viewMonth) return false;
    if (kind === "INCOME"   && item.kind !== "income")   return false;
    if (kind === "EXPENSE"  && item.kind !== "expense")  return false;
    if (kind === "TRANSFER" && item.kind !== "transfer") return false;
    if (srcFilter !== "ALL" && item.kind === "income" && (item as { source: string }).source !== srcFilter) return false;
    return true;
  }), [allItems, viewYear, viewMonth, kind, srcFilter]);

  const monthSources = useMemo(() =>
    [...new Set(allItems.filter(i => {
      const d = new Date(i.date);
      return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth && i.kind === "income";
    }).map(i => (i as { source: string }).source))],
    [allItems, viewYear, viewMonth]);

  const totalIn  = filtered.filter(i => i.kind === "income").reduce((s, i) => s + i.amount, 0);
  const totalOut = filtered.filter(i => i.kind === "expense").reduce((s, i) => s + i.amount, 0);
  const totalTxn = filtered.filter(i => i.kind === "transfer").reduce((s, i) => s + i.amount, 0);

  if (allItems.length === 0) return null;

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <section className="animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-500 dark:text-violet-400" strokeWidth={1.75} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Transaction Activity</h2>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border/50 flex items-center justify-center transition-all">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-semibold text-foreground min-w-32 text-center">{label}</span>
          <button onClick={() => navigate(1)} disabled={isCurrentMonth}
            className={cn("w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
              isCurrentMonth
                ? "bg-muted/30 border-border/30 opacity-30 cursor-not-allowed"
                : "bg-muted hover:bg-muted/80 border-border/50")}>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
        {totalIn  > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">+{formatCurrencyCompact(totalIn)}</span>}
        {totalOut > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 font-semibold">−{formatCurrencyCompact(totalOut)}</span>}
        {totalTxn > 0 && <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium">{formatCurrencyCompact(totalTxn)} moved</span>}
        <span className="text-muted-foreground/60">{filtered.length} entries</span>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Type tabs */}
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-xl border border-border/50">
          {(["ALL", "INCOME", "EXPENSE", "TRANSFER"] as FeedKind[]).map(k => (
            <button key={k}
              onClick={() => { setKind(k); if (k !== "INCOME") setSrcFilter("ALL"); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                kind === k
                  ? "bg-background text-foreground shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground",
              )}>
              {k === "ALL" ? "All" : k === "INCOME" ? "Income" : k === "EXPENSE" ? "Expenses" : "Transfers"}
            </button>
          ))}
        </div>

        {kind === "INCOME" && monthSources.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground/50" />
            {["ALL", ...monthSources].map(src => (
              <button key={src} onClick={() => setSrcFilter(src)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                  srcFilter === src
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                    : "border-border/50 text-muted-foreground hover:border-indigo-500/30 hover:text-foreground",
                )}>
                {src === "ALL" ? "All sources" : (INCOME_SOURCES.find(s => s.value === src)?.label ?? src)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            No {kind === "INCOME" ? "income" : kind === "EXPENSE" ? "expenses" : kind === "TRANSFER" ? "transfers" : "activity"} in {label}
          </p>
          <button onClick={() => navigate(-1)}
            className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
            ← Check previous month
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
          {filtered.map((item, idx) => {
            const isLast = idx === filtered.length - 1;

            if (item.kind === "income") {
              const src  = INCOME_ICON_MAP[item.source] ?? INCOME_ICON_MAP.OTHER;
              const Icon = src.icon;
              return (
                <div key={item.id}
                  className={cn(
                    "group/af flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors",
                    !isLast && "border-b border-border/40",
                  )}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: src.color + "20" }}>
                    <Icon className="w-[18px] h-[18px]" style={{ color: src.color }} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.description || INCOME_SOURCES.find(s => s.value === item.source)?.label || item.source}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {fmtDate(item.date)}
                      {item.accountName && <span className="mx-1.5 text-muted-foreground/25">·</span>}
                      {item.accountName && <span>{item.accountName}</span>}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums shrink-0">
                    +{formatCurrency(item.amount)}
                  </p>
                  <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                    <button onClick={() => onEditIncome({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteIncome(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            if (item.kind === "expense") {
              const catMeta = getCategoryMeta(item.categoryName);
              const catColor = item.color ?? catMeta.color;
              const CatIcon = catMeta.icon;
              return (
                <div key={item.id}
                  className={cn(
                    "group/af flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors",
                    !isLast && "border-b border-border/40",
                  )}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: catColor + "20" }}>
                    <CatIcon className="w-[18px] h-[18px]" style={{ color: catColor }} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.description || item.categoryName}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {fmtDate(item.date)}
                      {item.accountName && <span className="mx-1.5 text-muted-foreground/25">·</span>}
                      {item.accountName && <span>{item.accountName}</span>}
                      <span className="mx-1.5 text-muted-foreground/25">·</span>
                      <span className="font-medium" style={{ color: catColor }}>{item.categoryName}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums shrink-0">
                    −{formatCurrency(item.amount)}
                  </p>
                  <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                    <button onClick={() => onEditExpense({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteExpense(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            // transfer
            return (
              <div key={item.id}
                className={cn(
                  "group/af flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors",
                  !isLast && "border-b border-border/40",
                )}>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-[18px] h-[18px] text-violet-500 dark:text-violet-400" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.from} → {item.to}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {fmtDate(item.date)}
                    {item.description && <span className="mx-1.5 text-muted-foreground/25">·</span>}
                    {item.description && <span>{item.description}</span>}
                  </p>
                </div>
                <p className="text-sm font-bold text-violet-500 dark:text-violet-400 tabular-nums shrink-0">
                  {formatCurrency(item.amount)}
                </p>
                <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                  <button onClick={() => onEditTransfer({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => onDeleteTransfer(item.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
