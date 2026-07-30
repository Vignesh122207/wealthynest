"use client";

import {memo} from "react";
import {ArrowLeftRight, CreditCard, HandCoins, RefreshCw} from "lucide-react";
import {getCategoryColor, getCategoryIcon, INCOME_ICON_MAP} from "@/lib/categoryMeta";
import {badgeTextColor, PremiumIcon} from "@/components/icons/PremiumIcon";
import {useIsDark} from "@/hooks/useIsDark";
import {DebtBadge} from "@/features/expenses/components/TransactionRows";
import {INCOME_SOURCES} from "@/lib/constants";
import {cn} from "@/lib/utils";
import type {Expense} from "@/features/expenses/types/expense.types";
import type {IncomeEntry} from "@/features/income/types/income.types";
import type {AccountTransfer} from "@/features/accounts/types/account.types";
import type {TxRow} from "./types";

interface AllTransactionRowProps {
  row: TxRow;
  fmt: (n: number) => string;
  accountMap: Record<string, string>;
  balanceMap: Map<string, number>;
  onEditExpense: (e: Expense) => void;
  onEditIncome: (i: IncomeEntry) => void;
  onEditTransfer: (t: AccountTransfer) => void;
}

// One row of the "All" tab's merged feed — renders differently per transaction kind, but all
// three share the same row chrome (icon tile, title/meta line, right-aligned amount + running
// balance), so this stays one component switching on `row.kind` rather than three near-identical
// ones.
export const AllTransactionRow = memo(function AllTransactionRow({ row, fmt, accountMap, balanceMap, onEditExpense, onEditIncome, onEditTransfer }: AllTransactionRowProps) {
  const isDark = useIsDark();
  if (row.kind === "expense") {
    const e = row.data;
    const catIcon  = getCategoryIcon({ name: e.categoryName ?? "", icon: e.categoryIcon });
    const catColor = getCategoryColor(e.categoryName ?? "", e.categoryColor);
    return (
      <button type="button" onClick={() => onEditExpense(e)}
        aria-label={`Edit ${e.description || e.categoryName || "expense"}, ${fmt(e.amount)}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
        <PremiumIcon icon={catIcon} hex={catColor} size="sm" className="w-9 h-9" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate leading-5">
            {e.description || e.categoryName || "Expense"}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {e.categoryName && (
              <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                style={{ backgroundColor: catColor + "18", color: badgeTextColor(catColor, isDark) }}>{e.categoryName}</span>
            )}
            {e.accountId && accountMap[e.accountId] && (
              <span className="text-xs text-muted-foreground/80">{accountMap[e.accountId]}</span>
            )}
            {e.paymentMethod === "CREDIT_CARD" && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 font-medium">Card</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(e.amount)}</p>
          {e.accountId && balanceMap.has(`expense-${e.id}`) && (
            <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(`expense-${e.id}`)!)}</p>
          )}
        </div>
      </button>
    );
  }

  if (row.kind === "income") {
    const income = row.data;
    const src = INCOME_ICON_MAP[income.source] ?? INCOME_ICON_MAP.OTHER;
    return (
      <button type="button" onClick={() => onEditIncome(income)}
        aria-label={`Edit ${income.description || "income entry"}, ${fmt(income.amount)}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
        <PremiumIcon icon={src.icon} hex={src.color} size="sm" className="w-9 h-9" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate leading-5">
            {income.description || INCOME_SOURCES.find(s => s.value === income.source)?.label || income.source}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: src.color + "20", color: badgeTextColor(src.color, isDark) }}>
              {INCOME_SOURCES.find(s => s.value === income.source)?.label ?? income.source}
            </span>
            {income.accountId && accountMap[income.accountId] && (
              <span className="text-xs text-muted-foreground/80">{accountMap[income.accountId]}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">+{fmt(income.amount)}</p>
          {income.accountId && balanceMap.has(`income-${income.id}`) && (
            <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(`income-${income.id}`)!)}</p>
          )}
        </div>
      </button>
    );
  }

  const transfer = row.data;
  const isAdj  = transfer.adjustment;
  const isDebt = transfer.debt;
  const isIn   = !!transfer.toAccountId;
  const txnSign = (isAdj || isDebt) ? (isIn ? "+" : "−") : "";
  // A one-sided transfer (debt/adjustment) only ever has the "from" or the "to" side set, never
  // both — show whichever side actually has a balance entry instead of assuming "from" (which
  // left money received back with no balance shown at all, since only toAccountId is set on that leg).
  const balanceKey = balanceMap.has(`transfer-${transfer.id}-from`)
    ? `transfer-${transfer.id}-from`
    : `transfer-${transfer.id}-to`;
  return (
    <button type="button" onClick={() => onEditTransfer(transfer)}
      aria-label={`Edit transfer, ${fmt(transfer.amount)}`}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
      <PremiumIcon icon={isDebt ? (isIn ? HandCoins : CreditCard) : isAdj ? RefreshCw : ArrowLeftRight}
        hex={isDebt ? (isIn ? "#14b8a6" : "#f43f5e") : undefined}
        tone={isDebt ? undefined : isAdj ? "gray" : "indigo"} size="sm" className="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-5">
          {transfer.description || `${transfer.fromAccountName} → ${transfer.toAccountName}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {isDebt ? (
            <DebtBadge debtLabel={transfer.debtLabel} debtContactName={transfer.debtContactName} />
          ) : (
            <span className="text-xs text-muted-foreground/80">{transfer.fromAccountName} → {transfer.toAccountName}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-bold tabular-nums",
          isDebt ? (isIn ? "text-teal-500 dark:text-teal-400" : "text-rose-500 dark:text-rose-400")
            : isAdj ? "text-muted-foreground" : "text-indigo-500 dark:text-indigo-400")}>
          {txnSign}{fmt(transfer.amount)}
        </p>
        {balanceMap.has(balanceKey) && (
          <p className="text-[11px] text-muted-foreground/80 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(balanceKey)!)}</p>
        )}
      </div>
    </button>
  );
});
