import Link from "next/link";
import {Banknote, ShieldCheck, TrendingUp} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {NetWorthSummary} from "@/features/networth/types/networth.types";

// ─── Auto-linked assets — pulled live from Accounts & Investments ────────────

export function AutoLinkedAssets({ summary, loadingSum, fmt }: {
  summary:    NetWorthSummary | undefined;
  loadingSum: boolean;
  fmt: (n: number) => string;
}) {
  return (
    <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold text-foreground text-sm mb-1">Auto-Linked Assets</h3>
      <p className="text-xs text-muted-foreground/80 mb-4">Pulled live from your Accounts &amp; Investments — no manual entry needed.</p>
      <div className="space-y-2">
        {/* Cash & Bank — excludes Emergency Fund, which gets its own row below even
            though the backend's liquidBalance folds both together (EF is liquid money,
            just earmarked) — differently-colored concepts everywhere else in the app. */}
        <Link href="/accounts"
          className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
          <PremiumIcon icon={Banknote} tone="emerald" size="sm" className="shrink-0" />
          <p className="text-xs font-semibold text-foreground flex-1">Cash &amp; Bank Accounts</p>
          {loadingSum
            ? <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            : <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt((summary?.liquidBalance ?? 0) - (summary?.emergencyFund ?? 0))}</p>}
        </Link>

        {/* Emergency Fund */}
        {(summary?.emergencyFund ?? 0) > 0 && (
          <Link href="/accounts"
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
            <PremiumIcon icon={ShieldCheck} tone="orange" size="sm" className="shrink-0" />
            <p className="text-xs font-semibold text-foreground flex-1">Emergency Fund</p>
            {loadingSum
              ? <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              : <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(summary!.emergencyFund)}</p>}
          </Link>
        )}

        {/* Investment Portfolio — single total, breakdown is in Assets section */}
        {(summary?.investmentValue ?? 0) > 0 && (
          <Link href="/investments"
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
            <PremiumIcon icon={TrendingUp} tone="indigo" size="sm" className="shrink-0" />
            <p className="text-xs font-semibold text-foreground flex-1">Investment Portfolio</p>
            {loadingSum
              ? <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              : <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{fmt(summary!.investmentValue)}</p>}
          </Link>
        )}
      </div>
    </div>
  );
}
