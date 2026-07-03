"use client";

import { useState, useMemo } from "react";
import {
  Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Banknote, PieChart,
  Building2, AlertTriangle, Wallet, Layers, Coins, Percent, BarChart3,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Sector,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { useChartTheme } from "@/hooks/useChartTheme";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import {
  useAssets, useCreateAsset, useUpdateAsset, useDeleteAsset,
} from "@/features/assets/hooks/useAssets";
import {
  useLiabilities, useCreateLiability, useUpdateLiability, useDeleteLiability,
} from "@/features/liability/hooks/useLiabilities";
import { useNetWorthSummary, useNetWorthHistory } from "@/features/networth/hooks/useNetWorth";
import type { Asset } from "@/features/assets/types/asset.types";
import type { Liability, CreateLiabilityPayload } from "@/features/liability/types/liability.types";
import {
  ASSET_TYPES, ASSET_ICONS, ASSET_COLORS,
  LIABILITY_TYPES, LIABILITY_ICONS, LIABILITY_COLORS,
} from "@/lib/constants";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const assetSchema = z.object({
  name:         z.string().min(1, "Name is required").max(100),
  assetType:    z.string().min(1, "Type is required"),
  currentValue: z.coerce.number().min(0, "Value must be 0 or more"),
  institution:  z.string().max(100).optional(),
  notes:        z.string().optional(),
  asOfDate:     z.string().optional(),
});

const liabilitySchema = z.object({
  name:              z.string().min(1, "Name is required").max(100),
  liabilityType:     z.string().min(1, "Type is required"),
  principalAmount:   z.coerce.number().min(0, "Must be 0 or more"),
  outstandingAmount: z.coerce.number().min(0, "Must be 0 or more"),
  interestRate:      z.coerce.number().min(0).max(100).optional(),
  lenderName:        z.string().max(100).optional(),
  emiAmount:         z.coerce.number().min(0).optional(),
  startDate:         z.string().optional(),
  endDate:           z.string().optional(),
  notes:             z.string().optional(),
}).refine(
  d => Number(d.outstandingAmount) <= Number(d.principalAmount),
  { message: "Cannot exceed original loan amount", path: ["outstandingAmount"] },
);

type AssetFormValues     = z.infer<typeof assetSchema>;
type LiabilityFormValues = z.infer<typeof liabilitySchema>;

// ─── Investment type meta (for net worth breakdown) ──────────────────────────

const INV_TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType; tab: string }> = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paidPct(outstanding: number, principal: number) {
  if (!principal || principal <= 0) return 0;
  return Math.min(100, ((principal - outstanding) / principal) * 100);
}

function typeLabel(types: { value: string; label: string }[], val: string) {
  return types.find(t => t.value === val)?.label ?? val;
}

// ─── Asset Form ───────────────────────────────────────────────────────────────

function AssetForm({ title, defaultValues, onSubmit, onCancel, isPending }: {
  title:          string;
  defaultValues?: Partial<AssetFormValues>;
  onSubmit:       (v: AssetFormValues) => void;
  onCancel:       () => void;
  isPending:      boolean;
}) {
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: { asOfDate: new Date().toISOString().split("T")[0], ...defaultValues },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground/80 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormInput label="Name" placeholder="e.g. My Apartment"
            error={form.formState.errors.name?.message} {...form.register("name")} />
          <FormSelect label="Asset Type" options={ASSET_TYPES} placeholder="Select type"
            error={form.formState.errors.assetType?.message} {...form.register("assetType")} />
          <FormCurrencyInput label="Current Value" placeholder="0"
            error={form.formState.errors.currentValue?.message} {...form.register("currentValue")} />
          <FormInput label="Institution / Source" placeholder="e.g. SBI, Employer"
            {...form.register("institution")} />
          <Controller control={form.control} name="asOfDate" render={({ field }) => (
            <FormDatePicker label="As of Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <FormInput label="Notes (optional)" placeholder="Add a note…" {...form.register("notes")} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Asset"}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Liability Form ───────────────────────────────────────────────────────────

function LiabilityForm({ title, defaultValues, onSubmit, onCancel, isPending }: {
  title:          string;
  defaultValues?: Partial<LiabilityFormValues>;
  onSubmit:       (v: LiabilityFormValues) => void;
  onCancel:       () => void;
  isPending:      boolean;
}) {
  const form = useForm<LiabilityFormValues>({
    resolver: zodResolver(liabilitySchema),
    defaultValues,
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground/80 hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormInput label="Name" placeholder="e.g. HDFC Home Loan"
            error={form.formState.errors.name?.message} {...form.register("name")} />
          <FormSelect label="Type" options={LIABILITY_TYPES} placeholder="Select type"
            error={form.formState.errors.liabilityType?.message} {...form.register("liabilityType")} />
          <FormCurrencyInput label="Original Loan Amount" placeholder="0"
            error={form.formState.errors.principalAmount?.message} {...form.register("principalAmount")} />
          <FormCurrencyInput label="Outstanding Balance" placeholder="0"
            error={form.formState.errors.outstandingAmount?.message} {...form.register("outstandingAmount")} />
          <FormInput label="Interest Rate (% p.a.)" type="number" placeholder="8.5"
            {...form.register("interestRate")} />
          <FormCurrencyInput label="Monthly EMI" placeholder="0"
            {...form.register("emiAmount")} />
          <FormInput label="Lender / Bank" placeholder="e.g. HDFC Bank" {...form.register("lenderName")} />
          <Controller control={form.control} name="startDate" render={({ field }) => (
            <FormDatePicker label="Start Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <Controller control={form.control} name="endDate" render={({ field }) => (
            <FormDatePicker label="Expected Payoff Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <div className="sm:col-span-2 lg:col-span-3">
            <FormInput label="Notes (optional)" placeholder="Add a note…" {...form.register("notes")} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Liability"}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Asset Row ────────────────────────────────────────────────────────────────

function AssetRow({ asset, onEdit, onDelete }: {
  asset:    Asset;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const icon  = ASSET_ICONS[asset.assetType]  ?? "💰";
  const color = ASSET_COLORS[asset.assetType] ?? "#6366f1";
  return (
    <div className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ backgroundColor: color + "20" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{asset.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: color + "18", color }}>
            {typeLabel(ASSET_TYPES, asset.assetType)}
          </span>
          {asset.institution && <span className="text-xs text-muted-foreground/60">· {asset.institution}</span>}
          <span className="text-xs text-muted-foreground/60">· as of {formatDate(asset.asOfDate)}</span>
        </div>
        {asset.notes && <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{asset.notes}</p>}
      </div>
      <p className="text-sm font-bold text-emerald-300 tabular-nums shrink-0 min-w-[7rem] text-right">{formatCurrency(asset.currentValue)}</p>
      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Liability Row ────────────────────────────────────────────────────────────

function LiabilityRow({ liability, onEdit, onDelete }: {
  liability: Liability;
  onEdit:    () => void;
  onDelete:  () => void;
}) {
  const icon  = LIABILITY_ICONS[liability.liabilityType]  ?? "📋";
  const color = LIABILITY_COLORS[liability.liabilityType] ?? "#ef4444";
  const pct   = paidPct(liability.outstandingAmount, liability.principalAmount);
  // Compare date strings directly to avoid timezone-midnight false-positives
  const todayStr  = new Date().toISOString().split("T")[0];
  const isOverdue = !!(liability.endDate && liability.endDate < todayStr);

  return (
    <div className={cn("group px-5 py-4 hover:bg-muted/20 transition-colors", isOverdue && "border-l-2 border-amber-500/60 bg-amber-500/4")}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: color + "20" }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground truncate">{liability.name}</p>
                {isOverdue && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Overdue
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: color + "18", color }}>
                  {typeLabel(LIABILITY_TYPES, liability.liabilityType)}
                </span>
                {liability.lenderName && <span className="text-xs text-muted-foreground/60">· {liability.lenderName}</span>}
                {liability.interestRate != null && <span className="text-xs text-muted-foreground/60">· {liability.interestRate}% p.a.</span>}
                {liability.endDate && <span className="text-xs text-muted-foreground/60">· Payoff {formatDate(liability.endDate)}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(liability.outstandingAmount)}</p>
              <p className="text-xs text-muted-foreground/60">outstanding</p>
            </div>
          </div>
          {/* Repayment progress */}
          {liability.principalAmount > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground/60">Repaid</span>
                <span className="text-xs text-muted-foreground/80 tabular-nums">
                  {formatCurrency(liability.principalAmount - liability.outstandingAmount)} / {formatCurrency(liability.principalAmount)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground/60">{pct.toFixed(0)}% paid off</span>
                {liability.emiAmount && (
                  <span className="text-xs text-muted-foreground/80">EMI {formatCurrency(liability.emiAmount)}/mo</span>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 ml-2 mt-1">
          <button onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
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

  // Pie chart: liquid + emergency + per-investment-type slices + manual asset types
  const pieData = useMemo(() => {
    const slices: { name: string; value: number; color: string }[] = [];
    if ((summary?.liquidBalance ?? 0) > 0)  slices.push({ name: "Cash & Bank",    value: summary!.liquidBalance,  color: "#22c55e" });
    // Investment type breakdown (from assetBreakdown where available, else single total)
    if (invBreakdown.length > 0) {
      invBreakdown.forEach(b => {
        const meta = INV_TYPE_META[b.assetType];
        slices.push({ name: meta?.label ?? b.assetType, value: b.totalValue, color: meta?.color ?? "#6366f1" });
      });
    } else if ((summary?.investmentValue ?? 0) > 0) {
      slices.push({ name: "Investments", value: summary!.investmentValue, color: "#6366f1" });
    }
    manualBreakdown.forEach(b => {
      slices.push({ name: typeLabel(ASSET_TYPES, b.assetType), value: b.totalValue, color: ASSET_COLORS[b.assetType] ?? "#64748b" });
    });
    return slices.filter(s => s.value > 0).sort((a, b) => b.value - a.value);
  }, [summary, invBreakdown, manualBreakdown]);

  const debtRatio = summary && summary.totalAssets > 0
    ? Math.min(100, (summary.totalLiabilities / summary.totalAssets) * 100) : 0;

  const handleCreateAsset = (v: AssetFormValues) =>
    createAsset({ ...v, currentValue: Number(v.currentValue) } as any,
      { onSuccess: () => setShowAssetForm(false) });

  const handleUpdateAsset = (v: AssetFormValues) => {
    if (!editAsset) return;
    updateAsset({ id: editAsset.id, payload: { ...v, currentValue: Number(v.currentValue) } as any },
      { onSuccess: () => setEditAsset(null) });
  };

  const handleCreateLiab = (v: LiabilityFormValues) => {
    const p: CreateLiabilityPayload = {
      ...v, liabilityType: v.liabilityType as any,
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
      ...v, liabilityType: v.liabilityType as any,
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
      <Header title="Net Worth" />

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
      {(showAssetForm || editAsset) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAssetForm(false); setEditAsset(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {(showAssetForm && !editAsset) && (
              <AssetForm title="New Asset"
                onSubmit={handleCreateAsset} onCancel={() => setShowAssetForm(false)} isPending={creatingAsset} />
            )}
            {editAsset && (
              <AssetForm title={`Edit — ${editAsset.name}`}
                defaultValues={{ name: editAsset.name, assetType: editAsset.assetType, currentValue: editAsset.currentValue, institution: editAsset.institution, notes: editAsset.notes, asOfDate: editAsset.asOfDate }}
                onSubmit={handleUpdateAsset} onCancel={() => setEditAsset(null)} isPending={updatingAsset} />
            )}
          </div>
        </div>
      )}
      {(showLiabForm || editLiability) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowLiabForm(false); setEditLiability(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {(showLiabForm && !editLiability) && (
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
                onSubmit={handleUpdateLiab} onCancel={() => setEditLiability(null)} isPending={updatingLiab} />
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
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
                {formatCurrency(nw)}
              </p>
              {nwDelta != null && nwDeltaPct != null && (
                <span className={cn("mb-1 text-sm font-semibold tabular-nums",
                  nwDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {nwDelta >= 0 ? "+" : ""}{formatCurrencyCompact(nwDelta)} ({nwDeltaPct >= 0 ? "+" : ""}{nwDeltaPct.toFixed(1)}%) vs last month
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground/80 mb-2">Assets − Liabilities</p>
          {nw < 0 && !loadingSum && (
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-4">Your liabilities exceed your assets. Focus on paying down debt to build positive net worth.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Total Assets",      value: summary?.totalAssets,      color: "text-emerald-600 dark:text-emerald-400", icon: TrendingUp },
              { label: "Total Liabilities", value: summary?.totalLiabilities, color: "text-red-600 dark:text-red-400",     icon: TrendingDown },
              { label: "Cash & Bank",       value: summary?.liquidBalance,    color: "text-indigo-600 dark:text-indigo-400",  icon: Banknote },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn("w-3.5 h-3.5", color)} />
                  <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">{label}</p>
                </div>
                {loadingSum
                  ? <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
                  : <p className={cn("text-sm font-bold tabular-nums", color)}>{formatCurrency(value ?? 0)}</p>}
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
              {/* Cash & Bank */}
              <Link href="/accounts"
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/15">
                  <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-semibold text-foreground flex-1">Cash &amp; Bank Accounts</p>
                {loadingSum
                  ? <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  : <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(summary?.liquidBalance ?? 0)}</p>}
              </Link>


              {/* Investment Portfolio — single total, breakdown is in Assets section */}
              {(summary?.investmentValue ?? 0) > 0 && (
                <Link href="/investments"
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/15">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-xs font-semibold text-foreground flex-1">Investment Portfolio</p>
                  {loadingSum
                    ? <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    : <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{formatCurrency(summary!.investmentValue)}</p>}
                </Link>
              )}
            </div>
          </div>

          {/* Asset allocation donut */}
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-muted-foreground" />
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
                        activeShape={(props: any) => (
                          <Sector
                            cx={props.cx} cy={props.cy}
                            innerRadius={props.innerRadius} outerRadius={props.outerRadius + 5}
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
                        formatter={(v: number, _: string, props: any) => [
                          formatCurrency(v),
                          props?.payload?.name ?? "Amount",
                        ]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                  {/* Center label — z-0 keeps it below the Recharts tooltip layer (z-20) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                    <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">Total</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(summary?.totalAssets ?? 0)}</p>
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
                            <span className="text-xs text-muted-foreground ml-1.5 tabular-nums">{formatCurrency(s.value)}</span>
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-foreground">Assets</h2>
              {summary && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(summary.totalAssets)}</span>}
            </div>
            <button onClick={() => { setShowAssetForm(v => !v); setEditAsset(null); }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Asset
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Fallback: summary has investmentValue but no breakdown */}
            {invBreakdown.length === 0 && (summary?.investmentValue ?? 0) > 0 && (
              <Link href="/investments"
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/15">
                  <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Investment Portfolio</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">View in Investments</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400 min-w-[7rem] text-right">
                  {formatCurrency(summary!.investmentValue)}
                </p>
                <div className="w-[68px] shrink-0" />
              </Link>
            )}

            {/* Investment type rows — read-only, click → specific investments tab */}
            {invBreakdown.map(b => {
              const meta = INV_TYPE_META[b.assetType];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Link key={b.assetType} href={`/investments?tab=${meta.tab}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-b border-border/40 group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: meta.color + "20" }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      {b.count > 0 ? `${b.count} holding${b.count !== 1 ? "s" : ""}` : "Auto-linked"}
                      {" · "}View in Investments
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0 min-w-[7rem] text-right" style={{ color: meta.color }}>
                    {formatCurrency(b.totalValue)}
                  </p>
                  {/* Spacer matching the hidden edit/delete button area in AssetRow */}
                  <div className="w-[68px] shrink-0" />
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
                      onEdit={() => { setShowAssetForm(false); setEditAsset(a); }}
                      onDelete={() => setConfirmAsset(a.id)} />
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
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Liabilities</h2>
              <span className="text-xs text-muted-foreground/80">{liabilities.length}</span>
              {summary && <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(summary.totalLiabilities)}</span>}
            </div>
            <button onClick={() => { setShowLiabForm(v => !v); setEditLiability(null); }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-red-600/20 hover:bg-red-600/30 text-red-600 dark:text-red-400 border border-red-500/20 transition-all">
              <Plus className="w-3.5 h-3.5" /> Add Liability
            </button>
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
                    onEdit={() => { setShowLiabForm(false); setEditLiability(l); }}
                    onDelete={() => setConfirmLiab(l.id)} />
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
          <h2 className="text-sm font-semibold text-foreground mb-3">Net Worth History</h2>
          <div className="bg-card border border-border rounded-2xl p-5">
            {nwHistory.length > 1 ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">Monthly net worth trend (last {nwHistory.length} months)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={nwHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `₹${Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${(v / 1000).toFixed(0)}K`}`} />
                    <Tooltip
                      contentStyle={chart.tooltipStyle} labelStyle={chart.labelStyle} itemStyle={chart.itemStyle}
                      cursor={chart.cursorStyle}
                      formatter={(v: number) => [formatCurrency(v), "Net Worth"]}
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
    </div>
  );
}
