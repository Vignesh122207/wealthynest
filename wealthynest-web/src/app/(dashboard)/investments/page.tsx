"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, TrendingUp, Search, X,
  Layers, Coins, Building2, BadgePercent, Upload,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  useInvestments, useCreateInvestment, useUpdateInvestment,
  useDeleteInvestment, useGoldPrice, useGoldPriceInfo, useIncomeHistory, usePortfolioXirr,
} from "@/features/investments/hooks/useInvestments";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { INVESTMENT_TYPE_META } from "@/lib/investmentTypeMeta";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { fmtNum } from "@/features/investments/utils/formatNum";
import {
  TABS, TAB_TO_INVESTMENT_TYPE, SORT_OPTIONS, type TabId, type SortKey,
} from "@/features/investments/constants";
import { InvestmentCard } from "@/features/investments/components/InvestmentCard";
import { DividendSuggestionsSection } from "@/features/investments/components/DividendSuggestionsSection";
import { TabSummaryBar } from "@/features/investments/components/TabSummaryBar";
import { OverviewTab } from "@/features/investments/components/OverviewTab";
import dynamic from "next/dynamic";
import type { StockFormDefaults, StockSubmitValues } from "@/features/investments/components/forms/StockForm";
import type { MFFormDefaults, MFSubmitValues } from "@/features/investments/components/forms/MFForm";
import type { BondSubmitValues } from "@/features/investments/components/forms/BondForm";

// Lazy-loaded: exactly one of these five ever renders at a time (the active tab, and only once
// its add/edit modal is open) — this is the single heaviest page in the app, so keeping the
// other four out of the initial bundle at any given moment noticeably shrinks it.
const StockForm = dynamic(() => import("@/features/investments/components/forms/StockForm").then(m => m.StockForm), { ssr: false });
const MFForm    = dynamic(() => import("@/features/investments/components/forms/MFForm").then(m => m.MFForm), { ssr: false });
const GoldForm  = dynamic(() => import("@/features/investments/components/forms/GoldForm").then(m => m.GoldForm), { ssr: false });
const FDForm    = dynamic(() => import("@/features/investments/components/forms/FDForm").then(m => m.FDForm), { ssr: false });
const BondForm  = dynamic(() => import("@/features/investments/components/forms/BondForm").then(m => m.BondForm), { ssr: false });
const ImportCasModal = dynamic(
  () => import("@/features/casimport/components/ImportCasModal").then(m => m.ImportCasModal), { ssr: false });
import type { GoldFormValues, FDFormValues, BondFormValues } from "@/features/investments/schemas/investment.schema";

// The single shared submit handler below is wired to whichever of these 5 forms is showing for
// the active tab — each form only ever calls it with its own shape, but there's no single static
// type linking `tab` to `values` (they're independent params), so buildPayload still asserts the
// specific shape per branch after switching on `currentTab`.
type AnyInvestmentFormValues = StockSubmitValues | MFSubmitValues | GoldFormValues | FDFormValues | BondSubmitValues;
import type {
  Investment, CreateInvestmentPayload,
} from "@/features/investments/types/investment.types";
import type { WalletAccount } from "@/features/accounts/types/account.types";
import { cn, formatCurrency } from "@/lib/utils";

// Matches this page's own FAB action colors (Stock=indigo, Mutual Fund=emerald, Gold=amber,
// Fixed Deposit=sky, Bond=violet) — the tab bar used to render every active tab in the same
// flat indigo regardless of type, so switching to "Gold" didn't feel any different from "Bonds".
// Overview gets its own neutral slate, not indigo — it's the whole-portfolio summary, not the
// Stocks tab, and the two were rendering identically.
const TAB_ACTIVE_BG: Record<TabId, string> = {
  overview: "bg-slate-600",
  stocks:   "bg-indigo-600",
  mf:       "bg-emerald-600",
  gold:     "bg-amber-600",
  fd:       "bg-sky-600",
  bonds:    "bg-violet-600",
};

export default function InvestmentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab,       setTab]       = useState<TabId>("overview");

  // Sync tab from URL param on every navigation (e.g. /investments?tab=stocks)
  useEffect(() => {
    const p = searchParams.get("tab") as TabId | null;
    if (p && TABS.some(t => t.id === p)) setTab(p);
  }, [searchParams]);
  const [showForm,  setShowForm]  = useState(false);
  const [showCasImport, setShowCasImport] = useState(false);
  const [editItem,  setEditItem]  = useState<Investment | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sortKey,      setSortKey]      = useState<SortKey>("value_desc");
  const [stockSearch,  setStockSearch]  = useState("");
  const [incomeYear, setIncomeYear] = useState(new Date().getFullYear());

  const { data: investments = [], isLoading, isError, refetch } = useInvestments();
  const { data: goldPrice }                   = useGoldPrice();
  const { data: goldPriceInfo }               = useGoldPriceInfo();
  const { data: accounts = [] }               = useAccounts();
  const { data: incomeHistory }               = useIncomeHistory(incomeYear);
  const { data: portfolioXirr }               = usePortfolioXirr();

  const { mutate: create, isPending: creating } = useCreateInvestment();
  const { mutate: update, isPending: updating } = useUpdateInvestment();
  const { mutate: remove }                      = useDeleteInvestment();

  const bankAccounts = useMemo(() =>
    accounts.filter((a: WalletAccount) => a.accountType === "BANK_ACCOUNT" && !a.archived),
  [accounts]);

  // Debit/credit picker for buys & sells: investment accounts (broker cash) are where these usually
  // happen, so they're listed first, banks below — a single flat list, not sectioned by heading.
  const investmentAccounts = useMemo(() =>
    accounts.filter((a: WalletAccount) => a.accountType === "INVESTMENT" && !a.archived),
  [accounts]);

  const filtered = useMemo(() => {
    const typeMap: Record<string, string[]> = {
      stocks: ["STOCK"],
      mf:     ["MUTUAL_FUND"],
      gold:   ["GOLD", "GOLD_ETF"],
      fd:     ["FD"],
      bonds:  ["BOND"],
    };
    const base = tab === "overview"
      ? investments
      : investments.filter(i => typeMap[tab]?.includes(i.investmentType));

    return [...base].sort((a, b) => {
      switch (sortKey) {
        case "value_desc":    return b.currentValue - a.currentValue;
        case "gain_desc":     return (b.gainLoss ?? b.currentValue - b.investedAmount) - (a.gainLoss ?? a.currentValue - a.investedAmount);
        case "gain_pct_desc": return (b.gainLossPct ?? 0) - (a.gainLossPct ?? 0);
        case "name_asc":      return (a.companyName ?? a.symbol ?? "").localeCompare(b.companyName ?? b.symbol ?? "");
        case "date_desc":     return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:              return 0;
      }
    });
  }, [investments, tab, sortKey]);

  const buildPayload = useCallback((rawValues: AnyInvestmentFormValues, currentTab: TabId): CreateInvestmentPayload => {
    if (currentTab === "stocks") {
      const values = rawValues as StockSubmitValues;
      const units = Number(values.units);
      const price = Number(values.avgBuyPrice);
      return {
        investmentType: "STOCK",
        symbol: values.symbol, companyName: values.name, exchange: values.exchange ?? "NSE",
        units, avgBuyPrice: price, currentPrice: price,
        investedAmount: units * price, currentValue: units * price,
        purchaseDate: values.purchaseDate,
        brokerage: values.brokerage ? Number(values.brokerage) : undefined,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
      };
    }
    if (currentTab === "mf") {
      const values = rawValues as MFSubmitValues;
      const units = Number(values.units);
      const nav   = Number(values.avgBuyPrice);
      return {
        investmentType: "MUTUAL_FUND",
        schemeCode: values.schemeCode, companyName: values.name,
        units, avgBuyPrice: nav, currentPrice: nav,
        investedAmount: units * nav, currentValue: units * nav,
        purchaseDate: values.purchaseDate,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
      };
    }
    if (currentTab === "gold") {
      const values = rawValues as GoldFormValues;
      const grams = Number(values.quantityGrams);
      const price = Number(values.avgBuyPrice);
      const karat = Number(values.goldKarat ?? 22);
      const karatKey = `price${karat}k` as "price18k" | "price22k" | "price24k";
      const livePrice = goldPrice ? goldPrice[karatKey] : null;
      const liveVal   = livePrice ? grams * livePrice : grams * price;
      return {
        investmentType: "GOLD", companyName: values.companyName,
        quantityGrams: grams, goldKarat: karat, avgBuyPrice: price,
        currentPrice: livePrice ?? price,
        investedAmount: grams * price, currentValue: liveVal,
        purchaseDate: values.purchaseDate,
        debitAccountId: values.debitAccountId || undefined,
      };
    }
    if (currentTab === "fd") {
      const values = rawValues as FDFormValues;
      const principal = Number(values.investedAmount);
      return {
        investmentType: "FD", bankName: values.bankName,
        investedAmount: principal, currentValue: principal,
        couponRate: Number(values.couponRate), compoundingFrequency: values.compoundingFrequency,
        purchaseDate: values.purchaseDate, maturityDate: values.maturityDate,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
      };
    }
    // bonds
    const values = rawValues as BondSubmitValues;
    const faceVal = Number(values.faceValuePerBond);
    const qty     = Number(values.quantity);
    // _investedAmount is set by BondForm.handleBondSubmit (accounts for secondary market price)
    const total   = values._investedAmount ?? faceVal * qty;
    return {
      investmentType: "BOND", companyName: values.companyName,
      investedAmount: total, currentValue: total,
      units: qty, avgBuyPrice: faceVal,
      couponRate: Number(values.couponRate), couponFrequency: values.couponFrequency,
      couponCreditDay: values.couponCreditDay ? Number(values.couponCreditDay) : undefined,
      tdsRate: values.tdsRate ? Number(values.tdsRate) : undefined,
      purchaseDate: values.purchaseDate,
      maturityDate: values.maturityDate || undefined,
      linkedAccountId: values.linkedAccountId || undefined,
      debitAccountId: values.debitAccountId || undefined,
    };
  }, [goldPrice]);

  const handleSubmit = useCallback((values: AnyInvestmentFormValues) => {
    const payload = buildPayload(values, tab);
    if (editItem) {
      update({ id: editItem.id, payload }, { onSuccess: () => { setEditItem(null); setShowForm(false); } });
    } else {
      create(payload, { onSuccess: () => setShowForm(false) });
    }
  }, [editItem, create, update, buildPayload, tab]);

  const editDefaults = useCallback((inv: Investment) => {
    const base = { linkedAccountId: inv.linkedAccountId ?? "" };
    if (inv.investmentType === "FD")
      return { ...base, bankName: inv.bankName, investedAmount: inv.investedAmount,
        couponRate: inv.couponRate, purchaseDate: inv.purchaseDate,
        maturityDate: inv.maturityDate, compoundingFrequency: inv.compoundingFrequency };
    if (inv.investmentType === "BOND")
      return { ...base, companyName: inv.companyName,
        faceValuePerBond: inv.avgBuyPrice,          // stored as avgBuyPrice (per bond)
        quantity: inv.units,
        totalInvested: inv.investedAmount,
        tdsRate: inv.tdsRate,
        couponRate: inv.couponRate, couponFrequency: inv.couponFrequency,
        couponCreditDay: inv.couponCreditDay,
        purchaseDate: inv.purchaseDate, maturityDate: inv.maturityDate };
    if (inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF")
      return { companyName: inv.companyName, quantityGrams: inv.quantityGrams,
        goldKarat: inv.goldKarat ?? 22,
        avgBuyPrice: inv.avgBuyPrice, purchaseDate: inv.purchaseDate };
    if (inv.investmentType === "MUTUAL_FUND")
      return { ...base, units: Number(inv.units ?? 0).toFixed(2), avgBuyPrice: Number(inv.avgBuyPrice ?? 0).toFixed(2), purchaseDate: inv.purchaseDate };
    // STOCK — allow correcting initial quantity and price (updates the seed transaction)
    return { ...base, units: fmtNum(inv.units ?? 0), avgBuyPrice: fmtNum(inv.avgBuyPrice ?? 0), purchaseDate: inv.purchaseDate };
  }, []);

  const switchToTab = useCallback((inv: Investment): TabId => {
    if (inv.investmentType === "STOCK")        return "stocks";
    if (inv.investmentType === "MUTUAL_FUND")  return "mf";
    if (inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF") return "gold";
    if (inv.investmentType === "FD")           return "fd";
    return "bonds";
  }, []);

const tabCounts = useMemo(() => investments.reduce((acc, i) => {
    acc.overview++;
    if (i.investmentType === "STOCK")       acc.stocks++;
    else if (i.investmentType === "MUTUAL_FUND") acc.mf++;
    else if (i.investmentType === "GOLD" || i.investmentType === "GOLD_ETF") acc.gold++;
    else if (i.investmentType === "FD")     acc.fd++;
    else if (i.investmentType === "BOND")   acc.bonds++;
    return acc;
  }, { overview: 0, stocks: 0, mf: 0, gold: 0, fd: 0, bonds: 0 } as Record<TabId, number>),
  [investments]);

  const closeForm = () => { setShowForm(false); setEditItem(null); };
  const formTypeMeta = INVESTMENT_TYPE_META[TAB_TO_INVESTMENT_TYPE[tab] ?? "STOCK"];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Investments" subtitle="Monitor holdings, returns, and portfolio performance" />

      {confirmId && (
        <ConfirmDialog open title="Remove Investment"
          description="This investment will be removed from your portfolio."
          confirmLabel="Remove" danger
          onConfirm={() => { remove(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}

      {(showForm || editItem) && tab !== "overview" && (
        <TransactionModalOverlay onDismiss={closeForm} maxWidth="max-w-2xl">
          <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
            <div className="h-1.5" style={{ background: `linear-gradient(to right, ${formTypeMeta.hex}, ${formTypeMeta.hex}99)` }} />
            <div className="p-5">
            <FormModalHeader icon={formTypeMeta.icon} hex={formTypeMeta.hex}
              title={`${editItem ? "Edit" : "New"} ${TABS.find(t => t.id === tab)?.label.replace(/s$/, "")}`}
              onDelete={editItem ? () => { setConfirmId(editItem.id); closeForm(); } : undefined}
              onClose={closeForm} />
            {tab === "stocks" && (
              <StockForm
                defaultValues={editItem ? editDefaults(editItem) as StockFormDefaults : undefined}
                editStock={editItem?.investmentType === "STOCK" ? editItem : null}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                isEditing={!!editItem} />
            )}
            {tab === "mf" && (
              <MFForm
                defaultValues={editItem ? editDefaults(editItem) as MFFormDefaults : undefined}
                editMF={editItem?.investmentType === "MUTUAL_FUND" ? editItem : null}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                isEditing={!!editItem} />
            )}
            {tab === "gold" && (
              <GoldForm
                defaultValues={editItem ? editDefaults(editItem) as Partial<GoldFormValues> : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} goldPrice={goldPrice}
                bankAccounts={bankAccounts} investmentAccounts={investmentAccounts} isEditing={!!editItem} />
            )}
            {tab === "fd" && (
              <FDForm
                defaultValues={editItem ? editDefaults(editItem) as Partial<FDFormValues> : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                isEditing={!!editItem} />
            )}
            {tab === "bonds" && (
              <BondForm
                defaultValues={editItem ? editDefaults(editItem) as Partial<BondFormValues> : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                isEditing={!!editItem} />
            )}
            </div>
          </div>
        </TransactionModalOverlay>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4">
        {/* Tabs + Add button in one row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 overflow-x-auto pb-0 flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id}
                onClick={() => { setTab(id); closeForm(); router.replace(`/investments?tab=${id}`); }}
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  tab === id ? cn(TAB_ACTIVE_BG[id], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id !== "overview" && tabCounts[id] > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
                    tab === id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {tabCounts[id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-44 bg-muted/40 rounded-2xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} description="Couldn't load your investments. Check your connection and try again." />
        ) : tab === "overview" ? (
          <OverviewTab investments={investments} year={incomeYear} onYearChange={setIncomeYear} incomeHistory={incomeHistory} portfolioXirr={portfolioXirr} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={TrendingUp}
            title={`No ${TABS.find(t => t.id === tab)?.label ?? ""} yet`}
            description="Click Add above to start tracking this instrument."
            action={
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add Now
              </button>
            } />
        ) : (
          <div className="space-y-4">
            <TabSummaryBar investments={filtered} tab={tab} />
            {tab === "stocks" && <DividendSuggestionsSection stockCount={filtered.length} />}
            {tab === "gold" && goldPriceInfo && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PremiumIcon icon={Coins} tone="orange" size="xs" />
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Live Gold Rates</p>
                  </div>
                  {goldPriceInfo.lastUpdated && (
                    <p className="text-xs text-muted-foreground/80">
                      Updated {new Date(goldPriceInfo.lastUpdated).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{ label: "24K (999)", val: goldPriceInfo.price24k }, { label: "22K (916)", val: goldPriceInfo.price22k }, { label: "18K (750)", val: goldPriceInfo.price18k }].map(({ label, val }) => (
                    <div key={label} className="text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {val ? `${formatCurrency(Number(val))}/g` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === "stocks" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                <input
                  value={stockSearch}
                  onChange={e => setStockSearch(e.target.value)}
                  placeholder="Filter holdings by name or symbol…"
                  className="w-full h-9 pl-9 pr-9 rounded-xl bg-muted/50 border border-border text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
                {stockSearch && (
                  <button onClick={() => setStockSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground/80">{filtered.length} holding{filtered.length !== 1 ? "s" : ""}</p>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                className="h-8 px-2 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(tab === "stocks" && stockSearch
                ? filtered.filter(inv => {
                    const q = stockSearch.toLowerCase();
                    return (inv.companyName ?? "").toLowerCase().includes(q)
                        || (inv.symbol ?? "").toLowerCase().includes(q);
                  })
                : filtered
              ).map(inv => (
                <InvestmentCard key={inv.id} inv={inv}
                  onEdit={() => { setTab(switchToTab(inv)); setEditItem(inv); setShowForm(true); }}
                  bankAccounts={bankAccounts} investmentAccounts={investmentAccounts}
                  dividendRecords={
                    inv.investmentType === "STOCK"
                      ? (incomeHistory?.records.filter(r => r.investmentId === inv.id && r.incomeType === "DIVIDEND") ?? [])
                      : inv.investmentType === "BOND"
                      ? (incomeHistory?.records.filter(r => r.investmentId === inv.id && r.incomeType === "BOND_COUPON") ?? [])
                      : undefined
                  } />
              ))}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={
        tab === "overview"
          ? [
              { icon: TrendingUp, label: "Stock",         color: "indigo",  onClick: () => { setTab("stocks"); setEditItem(null); setShowForm(true); } },
              { icon: Layers,     label: "Mutual Fund",   color: "emerald", onClick: () => { setTab("mf");     setEditItem(null); setShowForm(true); } },
              { icon: Coins,      label: "Gold",          color: "amber",   onClick: () => { setTab("gold");   setEditItem(null); setShowForm(true); } },
              { icon: Building2,  label: "Fixed Deposit", color: "sky",     onClick: () => { setTab("fd");     setEditItem(null); setShowForm(true); } },
              { icon: BadgePercent, label: "Bond",        color: "violet",  onClick: () => { setTab("bonds");  setEditItem(null); setShowForm(true); } },
              { icon: Upload,     label: "Import from CAS", color: "rose",  onClick: () => setShowCasImport(true) },
            ]
          : [
              { icon: Plus, label: `Add ${TABS.find(t => t.id === tab)?.label.replace(/s$/, "") ?? "Investment"}`, color: "indigo", onClick: () => { setEditItem(null); setShowForm(true); } },
            ]
      } />

      {showCasImport && <ImportCasModal onClose={() => setShowCasImport(false)} />}
    </div>
  );
}
