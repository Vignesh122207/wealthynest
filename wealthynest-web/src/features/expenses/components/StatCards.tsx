import {Layers, type LucideIcon, Receipt, TrendingUp, Wallet} from "lucide-react";
import {type IconTone, PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";

function StatTile({ icon, tone, label, value, delta }: {
  icon: LucideIcon; tone: IconTone; label: string; value: string; delta?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <PremiumIcon icon={icon} tone={tone} size="xs" />
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest truncate">{label}</p>
      </div>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      {delta}
    </div>
  );
}

export function StatCards({ income, expenses, incomeDelta, expensesDelta, netSavingsDelta, transactionCount, periodLabel }: {
  income: number; expenses: number; incomeDelta?: number; expensesDelta?: number; netSavingsDelta?: number;
  transactionCount: number;
  /** Human-readable label for whatever date range is currently applied ("August 2026", "2026",
   * "Last 3 months"...) — shown only in the mobile hero card, where the four desktop tiles collapse
   * into one summary and lose the surrounding Toolbar context that would otherwise say which period
   * these numbers cover. */
  periodLabel: string;
}) {
  const { fmt } = useAmountFormatter();
  const net = income - expenses;

  function DeltaLine({ value, goodWhenUp }: { value: number; goodWhenUp: boolean }) {
    const isUp = value >= 0;
    const isGood = isUp === goodWhenUp;
    return (
      <p className={cn("text-xs mt-1 font-medium", isGood ? "text-emerald-500" : "text-red-500 dark:text-red-400")}>
        {isUp ? "▲" : "▼"} {Math.abs(value).toFixed(1)}% vs last month
      </p>
    );
  }

  return (
    <>
      {/* Desktop — the four-tile grid, unchanged. */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-3">
        <StatTile icon={Wallet} tone="green"
          label="Total Income" value={fmt(income)}
          delta={incomeDelta !== undefined && <DeltaLine value={incomeDelta} goodWhenUp={true} />} />
        <StatTile icon={Receipt} tone="red"
          label="Total Expenses" value={fmt(expenses)}
          delta={expensesDelta !== undefined && <DeltaLine value={expensesDelta} goodWhenUp={false} />} />
        <StatTile icon={TrendingUp} tone="indigo"
          label="Net Savings" value={`${net >= 0 ? "" : "−"}${fmt(Math.abs(net))}`}
          delta={netSavingsDelta !== undefined && <DeltaLine value={netSavingsDelta} goodWhenUp={true} />} />
        <StatTile icon={Layers} tone="purple"
          label="Transactions" value={String(transactionCount)} />
      </div>

      {/* Mobile — a single gradient hero card replaces the four tiles: Net Savings as the
          headline number (the one figure that actually answers "how am I doing"), Income/Expenses
          demoted to inline sub-stats beneath it. */}
      <div className="lg:hidden relative overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-indigo-500/25 bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1.2px)", backgroundSize: "14px 14px" }}
          aria-hidden
        />
        <div className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/75">
          <span>{periodLabel}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[11px] font-bold normal-case tracking-normal">{transactionCount} transactions</span>
        </div>
        <p className="relative text-xs font-semibold text-white/80 mt-3.5">Net Savings</p>
        <p className="relative text-[32px] leading-tight font-extrabold tabular-nums mt-0.5">
          {net >= 0 ? "" : "−"}{fmt(Math.abs(net))}
        </p>
        <div className="relative flex gap-2 mt-4">
          <div className="flex-1 bg-white/15 border border-white/20 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/85">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> INCOME
            </p>
            <p className="text-[15px] font-extrabold tabular-nums mt-0.5">{fmt(income)}</p>
          </div>
          <div className="flex-1 bg-white/15 border border-white/20 rounded-2xl px-3 py-2.5 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/85">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-300" /> EXPENSES
            </p>
            <p className="text-[15px] font-extrabold tabular-nums mt-0.5">{fmt(expenses)}</p>
          </div>
        </div>
      </div>
    </>
  );
}
