import { Wallet, Receipt, TrendingUp, Layers, type LucideIcon } from "lucide-react";
import { PremiumIcon, type IconTone } from "@/components/icons/PremiumIcon";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";

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

export function StatCards({ income, expenses, incomeDelta, expensesDelta, netSavingsDelta, transactionCount }: {
  income: number; expenses: number; incomeDelta?: number; expensesDelta?: number; netSavingsDelta?: number;
  transactionCount: number;
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
  );
}
