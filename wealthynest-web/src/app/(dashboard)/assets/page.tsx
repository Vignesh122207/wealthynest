"use client";

import { useState, useMemo } from "react";
import {
  Plus, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Banknote, PieChart,
  Building2, AlertTriangle, Wallet, Layers, Coins, Percent, BarChart3, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Sector,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { useChartTheme } from "@/hooks/useChartTheme";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import {
  useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset,
} from "@/features/assets/hooks/useAssets";
import { AssetForm } from "@/features/assets/components/AssetForm";
import { AssetRow } from "@/features/assets/components/AssetRow";
import type { AssetFormValues } from "@/features/assets/schemas/asset.schema";
import {
  useLiabilities, useCreateLiability, useUpdateLiability, useDeleteLiability,
} from "@/features/liability/hooks/useLiabilities";
import { LiabilityForm } from "@/features/liability/components/LiabilityForm";
import { LiabilityRow } from "@/features/liability/components/LiabilityRow";
import type { LiabilityFormValues } from "@/features/liability/schemas/liability.schema";
import { useNetWorthSummary, useNetWorthHistory } from "@/features/networth/hooks/useNetWorth";
import type { Asset } from "@/features/assets/types/asset.types";
import type { Liability, CreateLiabilityPayload } from "@/features/liability/types/liability.types";
import { ASSET_TYPES } from "@/lib/constants";
import { typeLabel } from "@/lib/netWorthTypeMeta";
import { withCategoricalColors } from "@/lib/chartColors";
import { formatChartTickINR, cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";

// ─── Investment type meta (for net worth breakdown) ──────────────────────────

const INV_TYPE_META: Record<string, { label: string; color: string; icon: LucideIcon; tab: string }> = {
  STOCK:       { label: "Stocks",         color: "#6366f1", icon: TrendingUp,  tab: "stocks"   },
  MUTUAL_FUND: { label: "Mutual Funds",   color: "#22c55e", icon: Layers,      tab: "mf"       },
  GOLD:        { label: "Gold",           color: "#f59e0b", icon: Coins,       tab: "gold"     },
  GOLD_ETF:    { label: "Gold ETF",       color: "#fbbf24", icon: Coins,       tab: "gold"     },
  FD:          { label: "Fixed Deposits", color: "#0ea5e9", icon: Building2,   tab: "fd"       },
  BOND:        { label: "Bonds",          color: "#8b5cf6", icon: Percent,     tab: "bonds"    },
  PPF:         { label: "PPF",            color: "#ec4899", icon: TrendingUp,  tab: "overview" },
  NPS:         { label: "NPS",            color: "#14b8a6", icon: TrendingUp,  tab: "overview" },
  REIT:        { label: "REIT",           color: "#f97316", icon: Building2,   tab: "overview" },
  OTHER:       { label: "Other Inv.",     color: "#64748b", icon: BarChart3,   tab: "overview" },
};
// Investment-origin types — explicitly listed so "OTHER" manual assets are NOT caught
const INVESTMENT_TYPE_KEYS = new Set([
  "STOCK", "MUTUAL_FUND", "GOLD", "GOLD_ETF", "FD", "BOND", "PPF", "NPS", "REIT",
]);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const { fmt, fmtC } = useAmountFormatter();
  const chart = useChartTheme();
  const [showAssetForm,  setShowAssetForm]  = useState(false);
  const [showLiabForm,   setShowLiabForm]   = useState(false);
  const [editAsset,      setEditAsset]      = useState<Asset | null>(null);
  const [editLiability,  setEditLiability]  = useState<Liability | null>(null);
  const [confirmAsset,   setConfirmAsset]   = useState<string | null>(null);
  const [confirmLiab,    setConfirmLiab]    = useState<string | null>(null);
  const [showAllAssets,  setShowAllAssets]  = useState(false);
  const [showAllLiabs,   setShowAllLiabs]   = useState(false);

  const { data: summary, isLoading: loadingSum } = useNetWorthSummary();
  const { data: nwHistory = [] }                 = useNetWorthHistory();
  const [histViewMode, setHistViewMode] = useState<"monthly" | "yearly">("monthly");

  const yearlyNwData = useMemo(() => {
    const byYear = new Map<number, { year: number; netWorth: number }>();
    for (const pt of nwHistory) {
      byYear.set(pt.year, { year: pt.year, netWorth: pt.netWorth });
    }
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [nwHistory]);

  const { data: rawAssets = [], isLoading: loadingAssets } = useAssets();
  // Exclude any asset whose type is an investment type — those are shown as aggregates above
  const assets = rawAssets.filter(a => !INVESTMENT_TYPE_KEYS.has(a.assetType));
  const { data: liabilities = [], isLoading: loadingLiabs } = useLiabilities();

  const { mutate: createAsset, isPending: creatingAsset }     = useCreateAsset();
  const { mutate: updateAsset, isPending: updatingAsset }     = useUpdateAsset();
  const { mutate: deleteAsset }                               = useDeleteAsset();
  const { mutate: createLiab,  isPending: creatingLiab }      = useCreateLiability();
  const { mutate: updateLiab,  isPending: updatingLiab }      = useUpdateLiability();
  const { mutate: deleteLiab }                                = useDeleteLiability();

  // Split assetBreakdown into investment types vs manual asset types
  const { invBreakdown, manualBreakdown } = useMemo(() => {
    const inv: { assetType: string; totalValue: number; count: number }[] = [];
    const manual: { assetType: string; totalValue: number; count: number }[] = [];
    (summary?.assetBreakdown ?? []).forEach(b => {
      if (INVESTMENT_TYPE_KEYS.has(b.assetType)) inv.push(b);
      else manual.push(b);
    });
    return { invBreakdown: inv, manualBreakdown: manual };
  }, [summary]);

  // Pie chart: cash & bank + emergency fund + per-investment-type slices + manual asset types.
  // Colors are assigned positionally (largest slice first) by withCategoricalColors, not per
  // category — fixed per-category colors collided whenever two categories landed in the same
  // chart (e.g. Real Estate and Stocks were both indigo).
  const pieData = useMemo(() => {
    const slices: { name: string; value: number }[] = [];
    const emergencyFund = summary?.emergencyFund ?? 0;
    const cashAndBank   = (summary?.liquidBalance ?? 0) - emergencyFund;
    if (cashAndBank > 0)   slices.push({ name: "Cash & Bank",    value: cashAndBank });
    if (emergencyFund > 0) slices.push({ name: "Emergency Fund", value: emergencyFund });
    // Investment type breakdown (from assetBreakdown where available, else single total)
    if (invBreakdown.length > 0) {
      invBreakdown.forEach(b => {
        const meta = INV_TYPE_META[b.assetType];
        slices.push({ name: meta?.label ?? b.assetType, value: b.totalValue });
      });
    } else if ((summary?.investmentValue ?? 0) > 0) {
      slices.push({ name: "Investments", value: summary!.investmentValue });
    }
    manualBreakdown.forEach(b => {
      slices.push({ name: typeLabel(ASSET_TYPES, b.assetType), value: b.totalValue });
    });
    const sorted = slices.filter(s => s.value > 0).sort((a, b) => b.value - a.value);
    return withCategoricalColors(sorted, chart.isDark);
  }, [summary, invBreakdown, manualBreakdown, chart.isDark]);

  const debtRatio = summary && summary.totalAssets > 0
    ? Math.min(100, (summary.totalLiabilities / summary.totalAssets) * 100) : 0;

  const handleCreateAsset = (v: AssetFormValues) =>
    createAsset({ ...v, currentValue: Number(v.currentValue) },
      { onSuccess: () => setShowAssetForm(false) });

  const handleUpdateAsset = (v: AssetFormValues) => {
    if (!editAsset) return;
    updateAsset({ id: editAsset.id, payload: { ...v, currentValue: Number(v.currentValue) } },
      { onSuccess: () => setEditAsset(null) });
  };

  const handleCreateLiab = (v: LiabilityFormValues) => {
    const p: CreateLiabilityPayload = {
      ...v,
      principalAmount: Number(v.principalAmount), outstandingAmount: Number(v.outstandingAmount),
      interestRate: v.interestRate ? Number(v.interestRate) : undefined,
      emiAmount:    v.emiAmount    ? Number(v.emiAmount)    : undefined,
      startDate:    v.startDate    || undefined,
      endDate:      v.endDate      || undefined,
      lenderName:   v.lenderName   || undefined,
      notes:        v.notes        || undefined,
    };
    createLiab(p, { onSuccess: () => setShowLiabForm(false) });
  };

  const handleUpdateLiab = (v: LiabilityFormValues) => {
    if (!editLiability) return;
    const p: CreateLiabilityPayload = {
      ...v,
      principalAmount: Number(v.principalAmount), outstandingAmount: Number(v.outstandingAmount),
      interestRate: v.interestRate ? Number(v.interestRate) : undefined,
      emiAmount:    v.emiAmount    ? Number(v.emiAmount)    : undefined,
      startDate:    v.startDate    || undefined,
      endDate:      v.endDate      || undefined,
      lenderName:   v.lenderName   || undefined,
      notes:        v.notes        || undefined,
    };
    updateLiab({ id: editLiability.id, payload: p }, { onSuccess: () => setEditLiability(null) });
  };

  const nw = summary?.totalNetWorth ?? 0;
  const PREVIEW_COUNT = 3;

  // Delta vs last snapshot for the banner
  const prevNw    = nwHistory.length >= 2 ? nwHistory[nwHistory.length - 2].netWorth : null;
  const nwDelta   = prevNw != null ? nw - prevNw : null;
  const nwDeltaPct = prevNw && prevNw !== 0 ? ((nw - prevNw) / Math.abs(prevNw)) * 100 : null;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Net Worth" subtitle="Everything you own versus everything you owe" />

      {confirmAsset && (
        <ConfirmDialog open title="Delete Asset"
          description="This asset will be permanently removed from your net worth."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteAsset(confirmAsset); setConfirmAsset(null); }}
          onCancel={() => setConfirmAsset(null)} />
      )}
      {confirmLiab && (
        <ConfirmDialog open title="Remove Liability"
          description="This liability will be permanently removed from your net worth."
          confirmLabel="Remove" danger
          onConfirm={() => { deleteLiab(confirmLiab); setConfirmLiab(null); }}
          onCancel={() => setConfirmLiab(null)} />
      )}

      {/* Asset / Liability modals */}
      {showAssetForm && !editAsset && (
        <AssetForm title="New Asset"
          onSubmit={handleCreateAsset} onCancel={() => setShowAssetForm(false)} isPending={creatingAsset} />
      )}
      {editAsset && (
        <AssetForm title={`Edit — ${editAsset.name}`}
          defaultValues={{ name: editAsset.name, assetType: editAsset.assetType, currentValue: editAsset.currentValue, institution: editAsset.institution, notes: editAsset.notes, asOfDate: editAsset.asOfDate }}
          onSubmit={handleUpdateAsset} onCancel={() => setEditAsset(null)} isPending={updatingAsset}
          onDelete={() => { setConfirmAsset(editAsset.id); setEditAsset(null); }} />
      )}
      {showLiabForm && !editLiability && (
        <LiabilityForm title="New Liability"
          onSubmit={handleCreateLiab} onCancel={() => setShowLiabForm(false)} isPending={creatingLiab} />
      )}
      {editLiability && (
        <LiabilityForm title={`Edit — ${editLiability.name}`}
          defaultValues={{
            name: editLiability.name, liabilityType: editLiability.liabilityType,
            principalAmount: editLiability.principalAmount, outstandingAmount: editLiability.outstandingAmount,
            interestRate: editLiability.interestRate, lenderName: editLiability.lenderName,
            emiAmount: editLiability.emiAmount, startDate: editLiability.startDate,
            endDate: editLiability.endDate, notes: editLiability.notes,
          }}
          onSubmit={handleUpdateLiab} onCancel={() => setEditLiability(null)} isPending={updatingLiab}
          onDelete={() => { setConfirmLiab(editLiability.id); setEditLiability(null); }} />
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Net Worth Banner ─────────────────────────────────────────────── */}
        <div className={cn("rounded-2xl border p-6",
          nw >= 0
            ? "bg-gradient-to-br from-indigo-600/15 to-violet-600/10 border-indigo-500/20"
            : "bg-gradient-to-br from-red-600/15 to-rose-600/10 border-red-500/20")}>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Net Worth</p>
          {loadingSum ? (
            <div className="h-10 w-48 bg-muted/60 rounded-xl animate-pulse mb-2" />
          ) : (
            <div className="flex items-end gap-3 mb-1">
              <p className={cn("text-4xl font-bold tabular-nums", nw >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400")}>
                {fmt(nw)}
              </p>
              {nwDelta != null && nwDeltaPct != null && (
                <span className={cn("mb-1 text-sm font-semibold tabular-nums",
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
                  debtRatio > 50 ? "text-red-600 dark:text-red-400" : debtRatio > 30 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                  {debtRatio.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                  debtRatio > 50 ? "bg-red-500" : debtRatio > 30 ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: `${debtRatio}%` }} />
              </div>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {debtRatio <= 30 ? "Healthy ratio — keep it up!" : debtRatio <= 50 ? "Moderate — consider reducing debt." : "High — prioritise debt reduction."}
              </p>
            </div>
          )}
        </div>

        {/* ── Top Section: Auto-Linked + Allocation Chart ─────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* Auto-linked assets */}
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

          {/* Asset allocation donut */}
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PremiumIcon icon={PieChart} tone="violet" size="xs" />
                <h3 className="font-semibold text-foreground text-sm">Asset Allocation</h3>
              </div>
              {summary && <span className="text-xs text-muted-foreground/80">{pieData.length} categories</span>}
            </div>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-center">
                <p className="text-sm text-muted-foreground/80">No assets tracked yet</p>
              </div>
            ) : (
              <div className="flex items-start gap-5">
                {/* Donut */}
                <div className="relative shrink-0" style={{ width: 180, height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={82}
                        paddingAngle={2} dataKey="value" stroke="none"
                        activeShape={(props: {
                          cx?: number; cy?: number; innerRadius?: number; outerRadius?: number;
                          startAngle?: number; endAngle?: number; fill?: string;
                        }) => (
                          <Sector
                            cx={props.cx} cy={props.cy}
                            innerRadius={props.innerRadius} outerRadius={(props.outerRadius ?? 0) + 5}
                            startAngle={props.startAngle} endAngle={props.endAngle}
                            fill={props.fill} stroke="none"
                          />
                        )}>
                        {pieData.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={chart.tooltipStyle}
                        labelStyle={chart.labelStyle}
                        itemStyle={chart.itemStyle}
                        wrapperStyle={{ zIndex: 20 }}
                        formatter={(v: number, _: string, props: { payload?: { name?: string } }) => [
                          fmt(v),
                          props.payload?.name ?? "Amount",
                        ]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  {/* Center label — z-0 keeps it below the Recharts tooltip layer (z-20) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                    <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">Total</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{fmt(summary?.totalAssets ?? 0)}</p>
                  </div>
                </div>

                {/* Legend with bars */}
                <div className="flex-1 min-w-0 space-y-2.5 overflow-y-auto max-h-44 pt-1 pr-3 pb-1">
                  {pieData.map((s) => {
                    const pct = summary?.totalAssets ? (s.value / summary.totalAssets) * 100 : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                            <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="text-xs font-semibold text-foreground tabular-nums">{pct.toFixed(1)}%</span>
                            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">{fmt(s.value)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: s.color + "cc" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Assets ───────────────────────────────────────────────────────── */}
        <section>
          {/* Add Asset lived here too, redundant with the FAB's own "Add Asset" action. */}
          <div className="flex items-center gap-2 mb-3">
            <PremiumIcon icon={Building2} tone="emerald" size="xs" />
            <h2 className="text-sm font-semibold text-foreground">Assets</h2>
            {summary && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(summary.totalAssets)}</span>}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Fallback: summary has investmentValue but no breakdown */}
            {invBreakdown.length === 0 && (summary?.investmentValue ?? 0) > 0 && (
              <Link href="/investments"
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40">
                <PremiumIcon icon={TrendingUp} tone="indigo" size="sm" className="w-10 h-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Investment Portfolio</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">View in Investments</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400 min-w-[7rem] text-right">
                  {fmt(summary!.investmentValue)}
                </p>
              </Link>
            )}

            {/* Investment type rows — read-only, click → specific investments tab */}
            {invBreakdown.map(b => {
              const meta = INV_TYPE_META[b.assetType];
              if (!meta) return null;
              return (
                <Link key={b.assetType} href={`/investments?tab=${meta.tab}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40 group">
                  <PremiumIcon icon={meta.icon} hex={meta.color} size="sm" className="w-10 h-10 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      {b.count > 0 ? `${b.count} holding${b.count !== 1 ? "s" : ""}` : "Auto-linked"}
                      {" · "}View in Investments
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0 min-w-[7rem] text-right" style={{ color: meta.color }}>
                    {fmt(b.totalValue)}
                  </p>
                </Link>
              );
            })}

            {/* Subtle divider between investment rows and manual assets */}
            {invBreakdown.length > 0 && assets.length > 0 && (
              <div className="mx-5 border-t border-dashed border-border/60" />
            )}

            {/* Manual asset rows — editable */}
            {loadingAssets ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />)}
              </div>
            ) : assets.length === 0 && invBreakdown.length === 0 ? (
              <EmptyState icon={Building2} title="No assets yet"
                description="Track physical assets like property, vehicles, gold, EPF balance, or business equity."
                action={
                  <button onClick={() => setShowAssetForm(true)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Add First Asset
                  </button>
                } />
            ) : (
              <>
                <div className="divide-y divide-border/40">
                  {(showAllAssets ? assets : assets.slice(0, PREVIEW_COUNT)).map(a => (
                    <AssetRow key={a.id} asset={a}
                      onEdit={() => { setShowAssetForm(false); setEditAsset(a); }} />
                  ))}
                </div>
                {assets.length > PREVIEW_COUNT && (
                  <button onClick={() => setShowAllAssets(v => !v)}
                    className="w-full py-3 text-xs text-muted-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 transition-colors border-t border-border/60">
                    {showAllAssets
                      ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                      : <><ChevronDown className="w-3.5 h-3.5" /> {assets.length - PREVIEW_COUNT} more assets</>}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Liabilities ──────────────────────────────────────────────────── */}
        <section>
          {/* Add Liability lived here too, redundant with the FAB's own "Add Liability" action. */}
          <div className="flex items-center gap-2 mb-3">
            <PremiumIcon icon={AlertTriangle} tone="red" size="xs" />
            <h2 className="text-sm font-semibold text-foreground">Liabilities</h2>
            <span className="text-xs text-muted-foreground/80">{liabilities.length}</span>
            {summary && <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">{fmt(summary.totalLiabilities)}</span>}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loadingLiabs ? (
              <div className="p-5 space-y-3">
                {[1,2].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
              </div>
            ) : liabilities.length === 0 ? (
              <EmptyState icon={Wallet} title="No liabilities tracked"
                description="Add loans, EMIs, or credit card debt to get a true net worth picture."
                action={
                  <button onClick={() => setShowLiabForm(true)}
                    className="flex items-center gap-2 bg-red-600/80 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Add Liability
                  </button>
                } />
            ) : (
              <div className="divide-y divide-border/40">
                {(showAllLiabs ? liabilities : liabilities.slice(0, PREVIEW_COUNT)).map(l => (
                  <LiabilityRow key={l.id} liability={l}
                    onEdit={() => { setShowLiabForm(false); setEditLiability(l); }} />
                ))}
              </div>
            )}
            {liabilities.length > PREVIEW_COUNT && (
              <button onClick={() => setShowAllLiabs(v => !v)}
                className="w-full py-3 text-xs text-muted-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 transition-colors border-t border-border/60">
                {showAllLiabs
                  ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                  : <><ChevronDown className="w-3.5 h-3.5" /> {liabilities.length - PREVIEW_COUNT} more liabilities</>}
              </button>
            )}
          </div>
        </section>

        {/* ── Net Worth History ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Net Worth History</h2>
            {nwHistory.length > 1 && (
              <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                {(["monthly", "yearly"] as const).map((mode) => (
                  <button key={mode} onClick={() => setHistViewMode(mode)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all",
                      histViewMode === mode
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}>
                    {mode === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            {nwHistory.length > 1 ? (
              histViewMode === "monthly" ? (
                <>
                  <p className="text-xs text-muted-foreground mb-4">Monthly net worth trend (last {nwHistory.length} months)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={nwHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={formatChartTickINR} />
                      <Tooltip
                        contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                        cursor={chart.cursorStyle}
                        formatter={(v: number) => [fmt(v), "Net Worth"]}
                      />
                      <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                      <Line
                        type="monotone" dataKey="netWorth" stroke="#6366f1" strokeWidth={2.5}
                        dot={{ fill: "#6366f1", r: 3.5, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#a78bfa", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-4">Year-end net worth snapshot ({yearlyNwData.length} {yearlyNwData.length === 1 ? "year" : "years"})</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={yearlyNwData} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={formatChartTickINR} />
                      <Tooltip
                        contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                        cursor={{ fill: "rgba(99,102,241,0.06)" }}
                        formatter={(v: number) => [fmt(v), "Net Worth"]}
                      />
                      <ReferenceLine y={0} stroke={chart.gridColor} strokeWidth={1.5} />
                      <Bar dataKey="netWorth" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="w-8 h-8 text-muted mb-2" />
                <p className="text-sm font-medium text-foreground">History builds over time</p>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">
                  A monthly snapshot is taken automatically on the 1st of each month.
                  Come back next month to see your net worth trend here.
                </p>
              </div>
            )}
          </div>
        </section>

        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Plus,    label: "Add Asset",     color: "emerald", onClick: () => { setShowAssetForm(true); setEditAsset(null); } },
        { icon: Banknote, label: "Add Liability", color: "rose",    onClick: () => { setShowLiabForm(true); setEditLiability(null); } },
      ]} />
    </div>
  );
}
