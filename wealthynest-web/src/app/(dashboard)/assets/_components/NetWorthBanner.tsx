import {TrendingDown, TrendingUp} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {cn} from "@/lib/utils";
import type {NetWorthSummary} from "@/features/networth/types/networth.types";

// ─── Net Worth Banner ─────────────────────────────────────────────────────────

export function NetWorthBanner({ summary, loadingSum, nwDelta, nwDeltaPct, debtRatio, unsecuredDebtRatio, fmt, fmtC }: {
  summary:    NetWorthSummary | undefined;
  loadingSum: boolean;
  nwDelta:    number | null;
  nwDeltaPct: number | null;
  debtRatio:  number;
  /** Same ratio, but numerator excludes home/car/gold-loan debt secured against an asset this
   * page already counts — used to color and caption the bar so a healthy mortgage doesn't read
   * as a debt-reduction warning the way a credit card balance should. */
  unsecuredDebtRatio: number;
  fmt:  (n: number) => string;
  fmtC: (n: number) => string;
}) {
  const nw = summary?.totalNetWorth ?? 0;

  return (
    <div className={cn("rounded-2xl border p-6",
      nw >= 0
        ? "bg-gradient-to-br from-indigo-600/15 to-violet-600/10 border-indigo-500/20"
        : "bg-gradient-to-br from-red-600/15 to-rose-600/10 border-red-500/20")}>
      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Net Worth</p>
      {loadingSum ? (
        <div className="h-10 w-48 bg-muted/60 rounded-xl animate-pulse mb-2" />
      ) : (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mb-1">
          <p className={cn("text-3xl sm:text-4xl font-bold tabular-nums break-words", nw >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400")}>
            {fmt(nw)}
          </p>
          {nwDelta != null && nwDeltaPct != null && (
            <span className={cn("mb-1 text-sm font-semibold tabular-nums break-words",
              nwDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {nwDelta >= 0 ? "+" : ""}{fmtC(nwDelta)} ({nwDeltaPct >= 0 ? "+" : ""}{nwDeltaPct.toFixed(1)}%) vs last month
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground/80 mb-2">Assets − Liabilities</p>
      {nw < 0 && !loadingSum && (
        <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-4">Your liabilities exceed your assets. Focus on paying down debt to build positive net worth.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Total Assets",      value: summary?.totalAssets,      color: "text-emerald-600 dark:text-emerald-400", icon: TrendingUp,   tone: "emerald" as const },
          { label: "Total Liabilities", value: summary?.totalLiabilities, color: "text-red-600 dark:text-red-400",     icon: TrendingDown, tone: "red" as const },
        ].map(({ label, value, color, icon: Icon, tone }) => (
          <div key={label} className="bg-muted/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <PremiumIcon icon={Icon} tone={tone} size="xs" />
              <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">{label}</p>
            </div>
            {loadingSum
              ? <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
              : <p className={cn("text-sm font-bold tabular-nums", color)}>{fmt(value ?? 0)}</p>}
          </div>
        ))}
      </div>

      {/* Debt-to-asset ratio */}
      {!loadingSum && summary && summary.totalAssets > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground/80">Debt-to-Asset Ratio</span>
            <span className={cn("text-xs font-bold tabular-nums",
              unsecuredDebtRatio > 50 ? "text-red-600 dark:text-red-400" : unsecuredDebtRatio > 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {debtRatio.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              unsecuredDebtRatio > 50 ? "bg-red-500" : unsecuredDebtRatio > 30 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${debtRatio}%` }} />
          </div>
          <p className="text-xs text-muted-foreground/80 mt-1">
            {unsecuredDebtRatio <= 30
              ? "Healthy — includes any home, car or gold loan, which are secured against assets you own."
              : unsecuredDebtRatio <= 50
                ? "Moderate unsecured debt (credit cards, personal loans) — consider paying it down."
                : "High unsecured debt — prioritise paying down credit cards or personal loans. A home/car/gold loan on its own isn't flagged here."}
          </p>
        </div>
      )}
    </div>
  );
}
