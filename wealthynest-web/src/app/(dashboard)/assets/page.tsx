"use client";

import {useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {Banknote, Plus} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {useChartTheme} from "@/hooks/useChartTheme";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {useAssets, useCreateAsset, useDeleteAsset, useUpdateAsset,} from "@/features/assets/hooks/useAssets";
import type {AssetFormValues} from "@/features/assets/schemas/asset.schema";
import {
    useCreateLiability,
    useDeleteLiability,
    useLiabilities,
    useUpdateLiability,
} from "@/features/liability/hooks/useLiabilities";
import type {LiabilityFormValues} from "@/features/liability/schemas/liability.schema";
import {useNetWorthHistory, useNetWorthSummary} from "@/features/networth/hooks/useNetWorth";
import type {Asset} from "@/features/assets/types/asset.types";
import type {CreateLiabilityPayload, Liability} from "@/features/liability/types/liability.types";
import {ASSET_TYPES} from "@/lib/constants";
import {typeLabel, unsecuredDebtRatio} from "@/lib/netWorthTypeMeta";
import {withCategoricalColors} from "@/lib/chartColors";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {INV_TYPE_META, INVESTMENT_TYPE_KEYS} from "./_components/netWorthMeta";
import {NetWorthBanner} from "./_components/NetWorthBanner";
import {AutoLinkedAssets} from "./_components/AutoLinkedAssets";
import {AssetsSection} from "./_components/AssetsSection";
import {LiabilitiesSection} from "./_components/LiabilitiesSection";
import {PurposeSection} from "./_components/PurposeSection";

// Lazy-loaded: only fetched once a user actually opens the add/edit form.
const AssetForm     = dynamic(() => import("@/features/assets/components/AssetForm").then(m => m.AssetForm), { ssr: false });
const LiabilityForm = dynamic(() => import("@/features/liability/components/LiabilityForm").then(m => m.LiabilityForm), { ssr: false });

// Lazy-loaded (kept SSR'd — these paint on first load, not after a click): both pull in
// recharts, same fix as home/page.tsx's chart widgets (see that file's own comment for the
// measured cause/effect) — splits their parse cost into their own chunk instead of this
// route's main one.
const AssetAllocationChart = dynamic(() => import("./_components/AssetAllocationChart").then(m => m.AssetAllocationChart));
const NetWorthHistoryChart = dynamic(() => import("./_components/NetWorthHistoryChart").then(m => m.NetWorthHistoryChart));

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

  const { data: rawAssets = [], isLoading: loadingAssets, isError: assetsError, refetch: refetchAssets } = useAssets();
  // Exclude any asset whose type is an investment type — those are shown as aggregates above
  const assets = rawAssets.filter(a => !INVESTMENT_TYPE_KEYS.has(a.assetType));
  const { data: liabilities = [], isLoading: loadingLiabs, isError: liabsError, refetch: refetchLiabs } = useLiabilities();

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

  // Pie chart: cash & bank + per-investment-type slices + manual asset types. Purpose-tagged
  // money (Emergency Fund, etc.) is earmarked within these totals, not a separate slice — it's
  // shown in the "By Purpose" section instead. Colors are assigned positionally (largest slice
  // first) by withCategoricalColors, not per category — fixed per-category colors collided
  // whenever two categories landed in the same chart (e.g. Real Estate and Stocks were both indigo).
  const pieData = useMemo(() => {
    const slices: { name: string; value: number }[] = [];
    const cashAndBank = summary?.liquidBalance ?? 0;
    if (cashAndBank > 0) slices.push({ name: "Cash & Bank", value: cashAndBank });
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
  const unsecuredRatio = unsecuredDebtRatio(summary?.liabilityBreakdown ?? [], summary?.totalAssets ?? 0);

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

        <NetWorthBanner summary={summary} loadingSum={loadingSum} nwDelta={nwDelta} nwDeltaPct={nwDeltaPct}
          debtRatio={debtRatio} unsecuredDebtRatio={unsecuredRatio} fmt={fmt} fmtC={fmtC} />

        {/* ── Top Section: Auto-Linked + Allocation Chart ─────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <AutoLinkedAssets summary={summary} loadingSum={loadingSum} fmt={fmt} />
          <AssetAllocationChart summary={summary} pieData={pieData} chart={chart} fmt={fmt} />
        </div>

        <AssetsSection
          summary={summary} invBreakdown={invBreakdown} assets={assets}
          loadingAssets={loadingAssets} assetsError={assetsError} refetchAssets={() => refetchAssets()}
          showAllAssets={showAllAssets} setShowAllAssets={setShowAllAssets}
          onAdd={() => setShowAssetForm(true)}
          onEdit={a => { setShowAssetForm(false); setEditAsset(a); }}
          fmt={fmt} />

        <PurposeSection purposeBreakdown={summary?.purposeBreakdown} fmt={fmt} />

        <LiabilitiesSection
          summary={summary} liabilities={liabilities}
          loadingLiabs={loadingLiabs} liabsError={liabsError} refetchLiabs={() => refetchLiabs()}
          showAllLiabs={showAllLiabs} setShowAllLiabs={setShowAllLiabs}
          onAdd={() => setShowLiabForm(true)}
          onEdit={l => { setShowLiabForm(false); setEditLiability(l); }}
          fmt={fmt} />

        <NetWorthHistoryChart
          nwHistory={nwHistory} yearlyNwData={yearlyNwData}
          histViewMode={histViewMode} setHistViewMode={setHistViewMode}
          chart={chart} fmt={fmt} />

        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Plus,    label: "Add Asset",     color: "emerald", testId: "fab-add-asset",     onClick: () => { setShowAssetForm(true); setEditAsset(null); } },
        { icon: Banknote, label: "Add Liability", color: "rose",    testId: "fab-add-liability", onClick: () => { setShowLiabForm(true); setEditLiability(null); } },
      ]} />
    </div>
  );
}
