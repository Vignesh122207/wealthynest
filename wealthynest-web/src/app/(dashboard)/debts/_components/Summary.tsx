import {ArrowDownLeft, ArrowUpRight} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {DebtRecord} from "@/features/debts/types/debt.types";

// ── Summary ───────────────────────────────────────────────────────────────────
// One fused hero card on both mobile and desktop — Net leads as the actual answer to "am I
// ahead or behind right now" (with a lent-vs-borrowed proportion bar under it), "You're owed"/
// "You owe" sit as flanking detail rather than three equally-weighted cards. Responsive via
// flex-direction alone (stacked on mobile, side-by-side on desktop) instead of two separate
// mobile/desktop markup branches — same card, same hierarchy, at every width.

export function Summary({ debts }: { debts: DebtRecord[] }) {
  const { fmt } = useAmountFormatter();
  const active      = debts.filter(d => d.status !== "SETTLED");
  const lentAmt     = active.filter(d => d.type === "LENT")    .reduce((s, d) => s + d.amountRemaining, 0);
  const borrowAmt   = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
  const lentCount   = active.filter(d => d.type === "LENT").length;
  const borrowCount = active.filter(d => d.type === "BORROWED").length;
  const net         = lentAmt - borrowAmt;
  const netGood     = net >= 0;
  const total       = lentAmt + borrowAmt;
  const lentPct     = total > 0 ? (lentAmt / total) * 100 : 50;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-0 animate-fade-in-up">
      {/* Net position — the hero figure */}
      <div className="flex-1 sm:pr-7 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">Net Position</p>
        <p className={cn(
          "text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight leading-none",
          netGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        )}>
          {netGood ? "+" : ""}{fmt(Math.abs(net))}
        </p>
        <p className={cn(
          "text-xs font-medium mt-2",
          netGood ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-rose-600/90 dark:text-rose-400/90"
        )}>
          {netGood ? "In your favour — you're owed more than you owe" : "You owe more than you're owed"}
        </p>
        {total > 0 && (
          <div className="h-1.5 rounded-full bg-muted overflow-hidden flex mt-4 max-w-xs">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${lentPct}%` }} />
            <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${100 - lentPct}%` }} />
          </div>
        )}
      </div>

      <div className="h-px sm:h-14 sm:w-px bg-border shrink-0" />

      {/* Flanking detail — vertically centered against the divider on desktop */}
      <div className="flex flex-row sm:flex-col justify-between sm:justify-center gap-4 sm:gap-3.5 pt-1 sm:pt-0 sm:pl-7">
        <div className="flex items-center gap-2.5 flex-1 sm:flex-initial min-w-0">
          <PremiumIcon icon={ArrowUpRight} tone="emerald" size="sm" className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">You&apos;re owed</p>
            <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">{fmt(lentAmt)}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{lentCount} active</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-1 sm:flex-initial min-w-0">
          <PremiumIcon icon={ArrowDownLeft} tone="red" size="sm" className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-tight">You owe</p>
            <p className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400 leading-tight mt-0.5">{fmt(borrowAmt)}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{borrowCount} active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
