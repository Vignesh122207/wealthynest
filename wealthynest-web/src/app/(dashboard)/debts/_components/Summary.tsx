import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown } from "lucide-react";
import { PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import type { DebtRecord } from "@/features/debts/types/debt.types";

// ── Summary ───────────────────────────────────────────────────────────────────

export function Summary({ debts }: { debts: DebtRecord[] }) {
  const { fmt } = useAmountFormatter();
  const active    = debts.filter(d => d.status !== "SETTLED");
  const lentAmt   = active.filter(d => d.type === "LENT")    .reduce((s, d) => s + d.amountRemaining, 0);
  const borrowAmt = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
  const net       = lentAmt - borrowAmt;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={ArrowUpRight} tone="emerald" size="xs" />
          <p className="text-xs text-muted-foreground">You&apos;re owed</p>
        </div>
        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(lentAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "LENT").length} active
        </p>
      </div>
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={ArrowDownLeft} tone="red" size="xs" />
          <p className="text-xs text-muted-foreground">You owe</p>
        </div>
        <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(borrowAmt)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {active.filter(d => d.type === "BORROWED").length} active
        </p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <PremiumIcon icon={net >= 0 ? TrendingUp : TrendingDown} tone={(net >= 0 ? "emerald" : "red") as IconTone} size="xs" />
          <p className="text-xs text-muted-foreground">Net</p>
        </div>
        <p className={cn("text-lg font-bold tabular-nums", net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {net >= 0 ? "+" : ""}{fmt(Math.abs(net))}
        </p>
        <p className={cn("text-xs mt-0.5", net >= 0 ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-rose-600/70 dark:text-rose-400/70")}>
          {net >= 0 ? "in your favour" : "you owe more"}
        </p>
      </div>
    </div>
  );
}
