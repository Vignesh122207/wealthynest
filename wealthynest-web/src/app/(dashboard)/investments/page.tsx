"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, TrendingUp, TrendingDown, Search, Pencil, Trash2, X,
  RefreshCw, BarChart3, Layers, Coins, Building2, Percent, Info,
  CheckCircle2, ChevronDown, ChevronUp, Banknote, CalendarDays,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import {
  useInvestments, useCreateInvestment, useUpdateInvestment,
  useDeleteInvestment, useGoldPrice, useGoldPriceInfo,
  useSipTransactions, useAddSipTransaction, useDeleteSipTransaction, useXirr, useDividendSuggestions,
  useIncomeHistory, useLogIncome,
} from "@/features/investments/hooks/useInvestments";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { investmentsApi } from "@/features/investments/api/investments.api";
import type {
  Investment, CreateInvestmentPayload, InvestmentSearchResult, SipTransaction,
  IncomeHistoryRecord,
} from "@/features/investments/types/investment.types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useChartTheme } from "@/hooks/useChartTheme";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",  label: "Overview",      icon: BarChart3 },
  { id: "stocks",    label: "Stocks",         icon: TrendingUp },
  { id: "mf",        label: "Mutual Funds",   icon: Layers },
  { id: "gold",      label: "Gold",           icon: Coins },
  { id: "fd",        label: "Fixed Deposits", icon: Building2 },
  { id: "bonds",     label: "Bonds",          icon: Percent },
] as const;

type TabId = typeof TABS[number]["id"];

const COUPON_FREQ = [
  { value: "MONTHLY",     label: "Monthly" },
  { value: "QUARTERLY",   label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "ANNUALLY",    label: "Annually" },
];

const COMPOUND_FREQ = [
  { value: "SIMPLE",      label: "Simple Interest" },
  { value: "QUARTERLY",   label: "Quarterly Compounding" },
  { value: "MONTHLY",     label: "Monthly Compounding" },
  { value: "HALF_YEARLY", label: "Half-Yearly Compounding" },
  { value: "ANNUALLY",    label: "Annual Compounding" },
];

const TAB_COLORS: Record<string, string> = {
  STOCK: "#6366f1", MUTUAL_FUND: "#22c55e", GOLD: "#f59e0b",
  GOLD_ETF: "#fbbf24", FD: "#0ea5e9", BOND: "#8b5cf6",
  PPF: "#ec4899", NPS: "#14b8a6", OTHER: "#64748b",
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const stockSchema = z.object({
  units:           z.coerce.number().positive("Must be > 0"),
  avgBuyPrice:     z.coerce.number().positive("Must be > 0"),
  purchaseDate:    z.string().min(1, "Purchase date required"),
  linkedAccountId: z.string().optional(),
  debitAccountId:  z.string().optional(),
  notes:           z.string().optional(),
});

const mfSchema = z.object({
  units:           z.coerce.number().positive("Units required"),
  avgBuyPrice:     z.coerce.number().positive("Buy NAV required"),
  purchaseDate:    z.string().min(1, "Date required"),
  linkedAccountId: z.string().optional(),
  debitAccountId:  z.string().optional(),
});

const goldSchema = z.object({
  companyName:    z.string().min(1, "Name required"),
  quantityGrams:  z.coerce.number().positive("Must be > 0"),
  goldKarat:      z.coerce.number().int().refine(v => [18, 22, 24].includes(v), "Select 18K, 22K, or 24K"),
  avgBuyPrice:    z.coerce.number().positive("Buy price per gram required"),
  purchaseDate:   z.string().min(1, "Date required"),
  debitAccountId: z.string().optional(),
  notes:          z.string().optional(),
});

const fdSchema = z.object({
  bankName:             z.string().min(1, "Bank name required"),
  investedAmount:       z.coerce.number().positive("Principal required"),
  couponRate:           z.coerce.number().positive("Rate required").max(50),
  purchaseDate:         z.string().min(1, "Start date required"),
  maturityDate:         z.string().min(1, "Maturity date required"),
  compoundingFrequency: z.string().default("QUARTERLY"),
  linkedAccountId:      z.string().optional(),
  debitAccountId:       z.string().optional(),
  notes:                z.string().optional(),
});

const bondSchema = z.object({
  companyName:      z.string().min(1, "Bond name required"),
  faceValuePerBond: z.coerce.number().positive("Face value required"),
  quantity:         z.coerce.number().positive("Quantity required"),
  couponRate:       z.coerce.number().positive("Rate required").max(30),
  couponFrequency:  z.string().default("HALF_YEARLY"),
  couponCreditDay:  z.coerce.number().min(1).max(31).optional(),
  purchaseDate:     z.string().min(1, "Purchase date required"),
  maturityDate:     z.string().optional(),
  linkedAccountId:  z.string().optional(),
  debitAccountId:   z.string().optional(),
  notes:            z.string().optional(),
});

const sipSchema = z.object({
  transactionDate: z.string().min(1, "Date required"),
  amount:          z.coerce.number().positive("Amount required"),
  units:           z.string().optional(),
  nav:             z.string().optional(),
});

// ─── Shared: LiveSearch ───────────────────────────────────────────────────────

interface LiveSearchProps {
  placeholder: string;
  minChars?: number;
  onSearch: (q: string) => Promise<InvestmentSearchResult[]>;
  renderResult: (r: InvestmentSearchResult) => React.ReactNode;
  onSelect: (r: InvestmentSearchResult) => void;
}

function LiveSearch({ placeholder, minChars = 2, onSearch, renderResult, onSelect }: LiveSearchProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InvestmentSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (q.length < minChars) { setResults([]); setOpen(false); setError(null); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await Promise.race([
          onSearch(q),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
        ]);
        setResults(res.slice(0, 10));
        setOpen(res.length > 0);
        if (res.length === 0) setError("No results found. Try a different name.");
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "timeout")
          setError("Search timed out. Please try again.");
        else
          setError("Search failed. Check your connection.");
        setResults([]);
      } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q, minChars]);

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-10 rounded-xl bg-muted/50 border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 focus:bg-background transition-all" />
        {loading
          ? <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 animate-spin" />
          : q && <button type="button" onClick={() => { setQ(""); setResults([]); setOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        }
      </div>
      {error && !open && q.length >= minChars && !loading && (
        <p className="text-xs text-amber-400 mt-1.5 pl-1">{error}</p>
      )}
      {open && results.length > 0 && (
        <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} type="button"
              onClick={() => { onSelect(r); setQ(""); setResults([]); setOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0">
              {renderResult(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Selected chip ────────────────────────────────────────────────────────────

function SelectedChip({ label, sub, onClear }: { label: string; sub?: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
      <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-4.5 h-4.5 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{label}</p>
        {sub && <p className="text-[11px] text-indigo-400/80 mt-0.5 font-mono">{sub}</p>}
      </div>
      <button type="button" onClick={onClear}
        className="w-7 h-7 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground/80 hover:text-foreground shrink-0 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Investment card ──────────────────────────────────────────────────────────

function InvestmentCard({ inv, onEdit, onDelete, dividendRecords }: {
  inv: Investment; onEdit: () => void; onDelete: () => void;
  dividendRecords?: IncomeHistoryRecord[];
}) {
  const gain  = inv.gainLoss ?? (inv.currentValue - inv.investedAmount);
  const pct   = inv.gainLossPct ?? (inv.investedAmount > 0 ? ((inv.currentValue - inv.investedAmount) / inv.investedAmount) * 100 : 0);
  const color = TAB_COLORS[inv.investmentType] ?? "#64748b";
  const isPos = gain >= 0;

  const daysToMaturity = useMemo(() => {
    if (!inv.maturityDate) return null;
    return Math.ceil((new Date(inv.maturityDate).getTime() - Date.now()) / 86400000);
  }, [inv.maturityDate]);

  const couponPerPeriod = useMemo(() => {
    if (inv.investmentType !== "BOND" || !inv.couponRate || !inv.investedAmount) return null;
    const n = inv.couponFrequency === "MONTHLY" ? 12 : inv.couponFrequency === "QUARTERLY" ? 4 :
              inv.couponFrequency === "HALF_YEARLY" ? 2 : 1;
    // investedAmount is total invested (faceVal × qty), so coupon = total × rate / periods
    return (inv.investedAmount * inv.couponRate / 100) / n;
  }, [inv]);

  const displayName = inv.companyName ?? inv.symbol ?? inv.bankName ?? inv.investmentType;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="group bg-card border border-border rounded-2xl p-4 hover:border-indigo-500/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: color + "20", color }}>
            {inv.symbol ? inv.symbol.slice(0, 2) : initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              {daysToMaturity !== null && daysToMaturity < 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  Matured
                </span>
              )}
              {daysToMaturity !== null && daysToMaturity >= 0 && daysToMaturity <= 30 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                  {daysToMaturity === 0 ? "Matures today!" : `Matures in ${daysToMaturity}d`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {inv.symbol && <span className="text-xs text-muted-foreground/80">{inv.symbol} · {inv.exchange ?? "NSE"}</span>}
              {inv.purchaseDate && <span className="text-xs text-muted-foreground/60">Since {formatDate(inv.purchaseDate)}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/80 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Invested</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(inv.investedAmount)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">Current Value</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(inv.currentValue)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-1 text-xs font-semibold tabular-nums",
          isPos ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isPos ? "+" : ""}{formatCurrency(gain)}
          <span className="text-xs font-normal">({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
        </div>

        {inv.investmentType === "STOCK" && inv.units && (
          <span className="text-xs text-muted-foreground/80 tabular-nums">
            {inv.units} × {formatCurrency(inv.livePrice ?? inv.currentPrice ?? 0)}
            {inv.dayChangePct != null && (
              <span className={cn("ml-1", inv.dayChangePct >= 0 ? "text-emerald-500" : "text-red-500")}>
                ({inv.dayChangePct >= 0 ? "+" : ""}{inv.dayChangePct.toFixed(2)}%)
              </span>
            )}
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/60" title={`Price as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {inv.investmentType === "MUTUAL_FUND" && inv.units && (
          <span className="text-xs text-muted-foreground/80 tabular-nums">
            {Number(inv.units).toFixed(3)} u × {formatCurrency(inv.livePrice ?? inv.currentPrice ?? 0)}
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/60" title={`NAV as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {(inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF") && inv.quantityGrams && (
          <span className="text-xs text-muted-foreground/80">
            {inv.quantityGrams}g · {inv.goldKarat ?? 22}K
            {inv.priceLastUpdated && (
              <span className="ml-1 text-muted-foreground/60" title={`Rate as of ${new Date(inv.priceLastUpdated).toLocaleString()}`}>
                · {new Date(inv.priceLastUpdated).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
            )}
          </span>
        )}
        {(inv.investmentType === "FD" || inv.investmentType === "BOND") && inv.maturityDate && (
          <span className="text-xs text-muted-foreground/80">Matures {formatDate(inv.maturityDate)}</span>
        )}
      </div>

      {inv.investmentType === "FD" && inv.accruedInterest != null && (
        <div className="mt-2 pt-2 border-t border-border/60 grid grid-cols-2 gap-2">
          <div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground/80">Accrued so far</p>
              <span title="Interest earned from purchase date to today. The full amount is credited to your income on the maturity date.">
                <Info className="w-2.5 h-2.5 text-muted-foreground/60 cursor-help" />
              </span>
            </div>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(inv.accruedInterest)}</p>
          </div>
          {inv.maturityAmount != null && (
            <div>
              <p className="text-xs text-muted-foreground/80">At maturity</p>
              <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">{formatCurrency(inv.maturityAmount)}</p>
            </div>
          )}
        </div>
      )}

      {inv.investmentType === "BOND" && couponPerPeriod != null && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/80">
            {inv.couponRate}% {inv.couponFrequency?.toLowerCase()} coupon
            {inv.couponCreditDay && ` · credit day ${inv.couponCreditDay}`}
          </span>
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 tabular-nums">{formatCurrency(couponPerPeriod)}/period</span>
        </div>
      )}

      {/* Auto-income credit note */}
      {inv.linkedAccountId && (
        <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-xs text-muted-foreground/80">
            {inv.investmentType === "STOCK"   ? "Dividends" :
             inv.investmentType === "BOND"    ? "Coupons" :
             inv.investmentType === "FD"      ? "Maturity payout" :
             "Income"} auto-credited to linked account
          </span>
        </div>
      )}

      {/* Per-investment dividend / coupon history panel */}
      {dividendRecords !== undefined && (
        <InvestmentIncomePanel
          records={dividendRecords}
          label={inv.investmentType === "BOND" ? "Coupons" : "Dividends"}
          accentColor={inv.investmentType === "BOND" ? "text-violet-600 dark:text-violet-400" : "text-indigo-600 dark:text-indigo-400"}
        />
      )}

      {/* SIP section for Mutual Funds */}
      {inv.investmentType === "MUTUAL_FUND" && <SipSection investmentId={inv.id} />}
    </div>
  );
}

// ─── Per-investment Income Panel (Dividends / Coupons inside the card) ────────

function InvestmentIncomePanel({ records, label, accentColor }: {
  records: IncomeHistoryRecord[]; label: string; accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const total = records.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-xs text-muted-foreground/80 hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {label} {records.length > 0 ? `(${records.length})` : ""}
        </span>
        {total > 0 && (
          <span className={cn("font-semibold tabular-nums", accentColor)}>+{formatCurrency(total)}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {records.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 pl-1">
              No {label.toLowerCase()} recorded yet. {label === "Dividends"
                ? "Dividends are fetched automatically from NSE data each evening."
                : "Coupons are calculated and logged automatically on payment dates."}
            </p>
          ) : (
            records.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CalendarDays className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDate(r.eventDate)}</span>
                  {r.perShare != null && (
                    <span className="text-xs text-muted-foreground/60">₹{Number(r.perShare).toFixed(2)}/sh</span>
                  )}
                </div>
                <span className={cn("text-xs font-semibold tabular-nums shrink-0", accentColor)}>
                  +{formatCurrency(r.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── SIP Section (inside MF card) ─────────────────────────────────────────────

function SipSection({ investmentId }: { investmentId: string }) {
  const [open, setOpen]           = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { data: sips = [], isLoading: sipsLoading } = useSipTransactions(open ? investmentId : null);
  const { data: xirr }                              = useXirr(open ? investmentId : null);
  const { mutate: addSip, isPending }               = useAddSipTransaction();
  const { mutate: deleteSip }                       = useDeleteSipTransaction();

  const form = useForm({ resolver: zodResolver(sipSchema), defaultValues: { transactionDate: new Date().toISOString().slice(0, 10), amount: "" as any, units: "", nav: "" } });

  const onAddSip = form.handleSubmit((vals) => {
    addSip({
      investmentId,
      data: {
        transactionDate: vals.transactionDate,
        amount:          Number(vals.amount),
        units:           vals.units ? Number(vals.units) : undefined,
        nav:             vals.nav   ? Number(vals.nav)   : undefined,
        transactionType: "BUY",
      },
    }, {
      onSuccess: () => { form.reset({ transactionDate: new Date().toISOString().slice(0, 10), amount: "" as any, units: "", nav: "" }); setShowAdd(false); },
    });
  });

  const xirrLabel = xirr != null && !isNaN(xirr as number)
    ? `${(xirr as number) >= 0 ? "+" : ""}${(xirr as number).toFixed(1)}% XIRR`
    : sips.length > 0 ? "Not enough data yet" : null;

  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); if (!open) setShowAdd(false); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors"
        >
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          SIP entries {sips.length > 0 && !open ? `(${sips.length})` : ""}
        </button>
        {xirrLabel && (
          <span className={cn("text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full",
            xirr == null || isNaN(xirr as number)
              ? "bg-muted/60 text-muted-foreground"
              : (xirr as number) >= 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
            {xirrLabel}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-1.5">
          {sipsLoading ? (
            <div className="h-8 bg-muted/30 rounded-lg animate-pulse" />
          ) : sips.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 pl-1">No SIP entries yet.</p>
          ) : (
            sips.map((s: SipTransaction) => (
              <div key={s.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-2.5 py-1.5 group/sip">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className="text-xs text-muted-foreground">{formatDate(s.transactionDate)}</span>
                  {s.units && <span className="text-xs text-muted-foreground/60">{Number(s.units).toFixed(3)} u</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold tabular-nums", s.transactionType === "REDEEM" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {s.transactionType === "REDEEM" ? "-" : "+"}{formatCurrency(s.amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setDeletingId(s.id); }}
                    className="opacity-0 group-hover/sip:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}

          {deletingId !== null && (
            <ConfirmDialog open
              title="Delete SIP entry"
              description="This SIP transaction will be permanently removed and totals will be recalculated."
              confirmLabel="Delete" danger
              onConfirm={() => { deleteSip({ investmentId, sipId: deletingId }); setDeletingId(null); }}
              onCancel={() => setDeletingId(null)} />
          )}

          {showAdd ? (
            <form onSubmit={onAddSip} className="bg-muted/20 rounded-xl p-3 space-y-2 mt-1">
              <div className="grid grid-cols-2 gap-2">
                <FormDatePicker label="Date" value={form.watch("transactionDate") ?? ""} onChange={v => form.setValue("transactionDate", v)} />
                <FormCurrencyInput label="Amount (₹)" {...form.register("amount")} error={form.formState.errors.amount?.message as string} />
                <FormCurrencyInput label="Units (opt)" {...form.register("units")} />
                <FormCurrencyInput label="NAV (opt)"   {...form.register("nav")} />
              </div>
              <div className="flex gap-1.5">
                <button type="submit" disabled={isPending}
                  className="flex-1 h-8 rounded-lg text-[11px] font-medium bg-emerald-600/80 hover:bg-emerald-600 text-white transition-all disabled:opacity-60">
                  {isPending ? "Saving…" : "Add SIP"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="h-8 px-3 rounded-lg text-[11px] text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors mt-1">
              <Plus className="w-3 h-3" /> Add SIP entry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared: Income History Section (Dividends / Coupons / FD Maturities) ─────

type IncomeType = "DIVIDEND" | "BOND_COUPON" | "FD_MATURITY";

const INCOME_CONFIG: Record<IncomeType, {
  title: string; subtitle: string; totalLabel: string; emptyHint: string;
  Icon: React.ElementType; accentColor: string; accentBg: string; accentBorder: string; spinColor: string;
  showPerShare: boolean;
}> = {
  DIVIDEND: {
    title: "Dividend Income History", subtitle: "Auto-credited dividends from purchase date onwards",
    totalLabel: "Total dividends received", emptyHint: "Dividends are fetched automatically when you add a stock.",
    Icon: Banknote, accentColor: "text-indigo-400", accentBg: "bg-indigo-500/12", accentBorder: "border-indigo-500/15",
    spinColor: "border-indigo-500", showPerShare: true,
  },
  BOND_COUPON: {
    title: "Coupon Payment History", subtitle: "Auto-credited coupon payments from purchase date",
    totalLabel: "Total coupon income", emptyHint: "Coupons are calculated automatically when you add a bond.",
    Icon: Percent, accentColor: "text-violet-400", accentBg: "bg-violet-500/12", accentBorder: "border-violet-500/15",
    spinColor: "border-violet-500", showPerShare: false,
  },
  FD_MATURITY: {
    title: "FD Maturity History", subtitle: "Maturity payouts credited automatically on maturity date",
    totalLabel: "Total FD maturity payouts", emptyHint: "Matured FDs are processed automatically.",
    Icon: Building2, accentColor: "text-sky-400", accentBg: "bg-sky-500/12", accentBorder: "border-sky-500/15",
    spinColor: "border-sky-500", showPerShare: false,
  },
};

function IncomeHistorySection({ incomeType, year, onYearChange }: {
  incomeType: IncomeType; year: number; onYearChange: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const { data: history, isLoading } = useIncomeHistory(year);
  const cfg = INCOME_CONFIG[incomeType];

  const records = history?.records.filter(r => r.incomeType === incomeType) ?? [];
  const total   = incomeType === "DIVIDEND"    ? (history?.summary.dividendTotal   ?? 0)
                : incomeType === "BOND_COUPON" ? (history?.summary.bondCouponTotal ?? 0)
                :                                (history?.summary.fdMaturityTotal  ?? 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <cfg.Icon className={`w-4 h-4 ${cfg.accentColor}`} />
            {cfg.title}
          </h3>
          <p className="text-xs text-muted-foreground/80 mt-0.5">{cfg.subtitle}</p>
        </div>
        <select value={year} onChange={e => onYearChange(Number(e.target.value))}
          className="h-8 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500">
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className={`flex items-center justify-between p-3 ${cfg.accentBg} border ${cfg.accentBorder} rounded-xl`}>
        <span className="text-xs text-muted-foreground">{cfg.totalLabel} in {year}</span>
        <span className={cn("text-sm font-bold tabular-nums", total > 0 ? cfg.accentColor : "text-muted-foreground/80")}>
          {total > 0 ? `+${formatCurrency(total)}` : "None yet"}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className={`w-4 h-4 border-2 ${cfg.spinColor} border-t-transparent rounded-full animate-spin`} />
        </div>
      ) : records.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Date</th>
                <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">
                  {incomeType === "DIVIDEND" ? "Stock" : incomeType === "BOND_COUPON" ? "Bond" : "Bank / FD"}
                </th>
                {cfg.showPerShare && <>
                  <th className="text-right text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Per Share</th>
                  <th className="text-right text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Shares</th>
                </>}
                <th className="text-right text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Amount</th>
                <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2">Account</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: IncomeHistoryRecord) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(r.eventDate)}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-foreground font-medium">{r.investmentName}</p>
                      {!r.investmentActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Sold</span>
                      )}
                    </div>
                    {r.symbol && <p className="text-xs text-muted-foreground/60">{r.symbol}</p>}
                  </td>
                  {cfg.showPerShare && <>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                      {r.perShare != null ? `₹${Number(r.perShare).toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                      {r.units != null ? Number(r.units).toFixed(0) : "—"}
                    </td>
                  </>}
                  <td className={`py-2.5 pr-4 text-right font-semibold ${cfg.accentColor} tabular-nums`}>
                    +{formatCurrency(r.amount)}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {r.accountName ?? <span className="text-muted-foreground/60 italic">Not linked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/80 text-center py-4">
          No {cfg.title.toLowerCase()} recorded for {year}.
          {year === currentYear && ` ${cfg.emptyHint}`}
        </p>
      )}
    </div>
  );
}

// ─── Dividend Suggestions Section (top of Stocks tab) ─────────────────────────

function DividendSuggestionsSection({ stockCount }: { stockCount: number }) {
  const { data: suggestions = [], isLoading } = useDividendSuggestions();
  const { mutate: logIncome, isPending: logging } = useLogIncome();
  const pending = suggestions.filter(s => !s.alreadyLogged);

  if (isLoading || stockCount === 0) return null;

  if (suggestions.length === 0) {
    return (
      <div className="flex items-start gap-3 p-3.5 bg-muted/40 border border-border/60 rounded-2xl">
        <Banknote className="w-4 h-4 text-muted-foreground/80 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Dividend data updates at 8 PM on trading days</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            To add dividend income now, go to <strong className="text-muted-foreground/80">Accounts → Add Money</strong> and select <em>Dividend</em> as the source.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-semibold text-amber-300">Dividend Income to Log</h3>
            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{pending.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {pending.map(s => (
              <div key={`${s.investmentId}-${s.exDate}`}
                className="flex items-center justify-between bg-card rounded-xl px-3 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{s.symbol}</p>
                  <p className="text-xs text-muted-foreground/80">
                    Ex-date {formatDate(s.exDate)} · ₹{Number(s.dividendPerShare).toFixed(2)}/share · {Number(s.sharesHeld).toFixed(0)} shares
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-amber-400 tabular-nums">
                    +{formatCurrency(s.suggestedIncome)}
                  </span>
                  <button
                    disabled={logging}
                    onClick={() => logIncome({
                      investmentId: s.investmentId,
                      data: {
                        incomeType: "DIVIDEND",
                        exDate: s.exDate,
                        amount: s.suggestedIncome,
                        perShare: s.dividendPerShare,
                        shares: s.sharesHeld,
                      },
                    })}
                    className="h-6 px-2 rounded-lg text-xs font-semibold bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all disabled:opacity-50 whitespace-nowrap">
                    Log
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60">
            Click <strong className="text-muted-foreground/80">Log</strong> to record the income. Each entry is dedup-protected — logging twice has no effect.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Form buttons ─────────────────────────────────────────────────────────────

function FormButtons({ onCancel, isPending, label, color }: {
  onCancel: () => void; isPending: boolean; label: string; color: string;
}) {
  const bgMap: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    amber: "bg-amber-600 hover:bg-amber-500",
    sky: "bg-sky-600 hover:bg-sky-500",
    violet: "bg-violet-600 hover:bg-violet-500",
  };
  return (
    <div className="flex gap-2 pt-1">
      <button type="submit" disabled={isPending}
        className={cn("flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60", bgMap[color] ?? bgMap.indigo)}>
        {isPending ? "Saving…" : label}
      </button>
      <button type="button" onClick={onCancel}
        className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
        Cancel
      </button>
    </div>
  );
}

// ─── Stock Form ───────────────────────────────────────────────────────────────

function StockForm({ defaultValues, onSubmit, onCancel, isPending, accountOptions, editStock, isEditing }: any) {
  const [selected, setSelected] = useState<{ symbol: string; name: string; exchange: string } | null>(
    editStock ? { symbol: editStock.symbol ?? "", name: editStock.companyName ?? editStock.symbol ?? "", exchange: editStock.exchange ?? "NSE" } : null
  );
  const form = useForm({ resolver: zodResolver(stockSchema), defaultValues });

  const handleSelect = (r: InvestmentSearchResult) => {
    setSelected({ symbol: r.symbol ?? "", name: r.name, exchange: r.exchange ?? "NSE" });
  };

  return (
    <form onSubmit={form.handleSubmit(values => {
      if (!selected) return;
      onSubmit({ ...values, ...selected });
    })} className="space-y-4">

      {/* Search / selected chip */}
      {selected ? (
        <SelectedChip
          label={selected.name}
          sub={`${selected.symbol} · ${selected.exchange}`}
          onClear={() => setSelected(null)} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Search and select a stock <span className="text-red-400">*</span>
          </label>
          <LiveSearch
            placeholder="Type stock name or symbol (e.g. Infosys, RELIANCE)"
            onSearch={investmentsApi.searchStocks}
            renderResult={r => (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-400">{(r.symbol ?? r.name).slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-muted-foreground/70">{r.symbol}</span>
                    <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded",
                      r.exchange === "BSE"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                    )}>{r.exchange ?? "NSE"}</span>
                  </div>
                </div>
              </div>
            )}
            onSelect={handleSelect} />
          <p className="text-xs text-muted-foreground/60 mt-1.5">You must select from the list. Results from NSE and BSE.</p>
        </div>
      )}

      {selected && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormCurrencyInput label="Quantity (shares)" {...form.register("units")}
            error={form.formState.errors.units?.message as string} />
          <FormCurrencyInput label="Buy Price per Share (₹)" {...form.register("avgBuyPrice")}
            error={form.formState.errors.avgBuyPrice?.message as string} />
          <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
              onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          {accountOptions?.length > 0 && (
            <FormSelect label="Auto-credit Dividends To"
              options={[{ value: "", label: "None" }, ...accountOptions]}
              {...form.register("linkedAccountId")} />
          )}
          {!isEditing && accountOptions?.length > 0 && (
            <FormSelect label="Debit from Account (optional)"
              options={[{ value: "", label: "None (no debit)" }, ...accountOptions]}
              {...form.register("debitAccountId")} />
          )}
          <div>
            <FormInput label="Notes" placeholder="Optional" {...form.register("notes")} />
          </div>
        </div>
      )}

      {selected && <FormButtons onCancel={onCancel} isPending={isPending} label="Save Stock" color="indigo" />}
      {!selected && (
        <button type="button" onClick={onCancel}
          className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors">
          Cancel
        </button>
      )}
    </form>
  );
}

// ─── MF Form ─────────────────────────────────────────────────────────────────

function MFForm({ defaultValues, onSubmit, onCancel, isPending, accountOptions, editMF, isEditing }: any) {
  const [selected, setSelected] = useState<{ schemeCode: string; name: string } | null>(
    editMF ? { schemeCode: editMF.schemeCode ?? "", name: editMF.companyName ?? "" } : null
  );
  const form = useForm({ resolver: zodResolver(mfSchema), defaultValues });

  return (
    <form onSubmit={form.handleSubmit(values => {
      if (!selected) return;
      onSubmit({ ...values, ...selected });
    })} className="space-y-4">

      {selected ? (
        <SelectedChip label={selected.name} sub={`Code: ${selected.schemeCode}`} onClear={() => setSelected(null)} />
      ) : (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Search and select a fund <span className="text-red-400">*</span>
          </label>
          <LiveSearch
            placeholder="Type fund name (e.g. Mirae, SBI Bluechip)"
            minChars={3}
            onSearch={investmentsApi.searchMF}
            renderResult={r => (
              <p className="text-sm font-medium text-foreground leading-snug">{r.name}</p>
            )}
            onSelect={r => setSelected({ schemeCode: r.schemeCode ?? "", name: r.name })} />
          <p className="text-xs text-muted-foreground/60 mt-1.5">Powered by MFAPI · Type at least 3 characters</p>
        </div>
      )}

      {selected && (
        <div className="grid sm:grid-cols-2 gap-4">
          <FormCurrencyInput label="Units" {...form.register("units")}
            error={form.formState.errors.units?.message as string} />
          <FormCurrencyInput label="Buy NAV (₹ per unit)" {...form.register("avgBuyPrice")}
            error={form.formState.errors.avgBuyPrice?.message as string} />
          <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
              onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          {accountOptions?.length > 0 && (
            <FormSelect label="Link Account (SIP tracking)"
              options={[{ value: "", label: "None" }, ...accountOptions]}
              {...form.register("linkedAccountId")} />
          )}
          {!isEditing && accountOptions?.length > 0 && (
            <FormSelect label="Debit from Account (optional)"
              options={[{ value: "", label: "None (no debit)" }, ...accountOptions]}
              {...form.register("debitAccountId")} />
          )}
        </div>
      )}

      {selected && <FormButtons onCancel={onCancel} isPending={isPending} label="Save Fund" color="emerald" />}
      {!selected && (
        <button type="button" onClick={onCancel}
          className="text-sm text-muted-foreground/80 hover:text-foreground transition-colors">
          Cancel
        </button>
      )}
    </form>
  );
}

// ─── Gold Form ────────────────────────────────────────────────────────────────

const KARAT_OPTIONS = [
  { value: 22, label: "22K (standard jewellery)" },
  { value: 24, label: "24K (pure gold / coins)" },
  { value: 18, label: "18K (hallmark jewellery)" },
] as const;

function GoldForm({ defaultValues, onSubmit, onCancel, isPending, goldPrice, accountOptions, isEditing }: any) {
  const form = useForm({
    resolver: zodResolver(goldSchema),
    defaultValues: { goldKarat: 22, ...defaultValues },
  });
  const qty      = Number(form.watch("quantityGrams") ?? 0);
  const buyPrice = Number(form.watch("avgBuyPrice")   ?? 0);
  const karat    = Number(form.watch("goldKarat")     ?? 22);

  const karatKey   = `price${karat}k` as "price18k" | "price22k" | "price24k";
  const livePrice  = goldPrice ? goldPrice[karatKey] : null;

  // Auto-suggest current live price when buy price is blank and live price loads
  useEffect(() => {
    if (livePrice && !form.getValues("avgBuyPrice")) {
      form.setValue("avgBuyPrice", Math.round(livePrice) as any);
    }
  }, [livePrice, karat]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentVal = qty > 0 && livePrice ? qty * livePrice : null;
  const invested   = qty > 0 && buyPrice  ? qty * buyPrice  : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {goldPrice && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <Coins className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            Live {karat}K gold: <strong>{livePrice ? formatCurrency(livePrice) : "—"}/gram</strong>
            <span className="text-muted-foreground/80 ml-2">
              (24K ₹{goldPrice.price24k?.toFixed(0)} · 22K ₹{goldPrice.price22k?.toFixed(0)} · 18K ₹{goldPrice.price18k?.toFixed(0)})
            </span>
          </span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <FormInput label="Description" placeholder="e.g. Digital Gold, Physical Gold"
          {...form.register("companyName")} error={form.formState.errors.companyName?.message as string} />
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Karat</label>
          <select {...form.register("goldKarat", { valueAsNumber: true })}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber-500">
            {KARAT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {(form.formState.errors.goldKarat?.message as string) && (
            <p className="text-xs text-red-400 mt-1">{form.formState.errors.goldKarat?.message as string}</p>
          )}
        </div>
        <FormCurrencyInput label="Quantity (grams)" {...form.register("quantityGrams")}
          error={form.formState.errors.quantityGrams?.message as string} />
        <FormCurrencyInput label="Buy Price per Gram (₹)" {...form.register("avgBuyPrice")}
          error={form.formState.errors.avgBuyPrice?.message as string} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        {(invested != null || currentVal != null) && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            {invested != null && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground/80 mb-0.5">Amount invested</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(invested)}</p>
              </div>
            )}
            {currentVal != null && (
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground/80 mb-0.5">Current market value ({karat}K)</p>
                <p className="text-sm font-bold text-amber-400 tabular-nums">{formatCurrency(currentVal)}</p>
              </div>
            )}
          </div>
        )}
        {!isEditing && accountOptions?.length > 0 && (
          <FormSelect label="Debit from Account (optional)"
            options={[{ value: "", label: "None (no debit)" }, ...accountOptions]}
            {...form.register("debitAccountId")} />
        )}
        <FormInput label="Notes" {...form.register("notes")} />
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save Gold" color="amber" />
    </form>
  );
}

// ─── FD Form ──────────────────────────────────────────────────────────────────

function FDForm({ defaultValues, onSubmit, onCancel, isPending, accountOptions, isEditing }: any) {
  const form = useForm({
    resolver: zodResolver(fdSchema),
    defaultValues: { compoundingFrequency: "QUARTERLY", ...defaultValues },
  });
  const principal = Number(form.watch("investedAmount") ?? 0);
  const rate      = Number(form.watch("couponRate")      ?? 0);
  const startDate = form.watch("purchaseDate");
  const matDate   = form.watch("maturityDate");
  const compFreq  = form.watch("compoundingFrequency") ?? "QUARTERLY";

  const maturityAmt = useMemo(() => {
    if (!principal || !rate || !startDate || !matDate) return null;
    const days = (new Date(matDate).getTime() - new Date(startDate).getTime()) / 86400000;
    if (days <= 0) return null;
    if (compFreq === "SIMPLE") return principal * (1 + rate / 100 * days / 365);
    const n = compFreq === "MONTHLY" ? 12 : compFreq === "QUARTERLY" ? 4 : compFreq === "HALF_YEARLY" ? 2 : 1;
    return principal * Math.pow(1 + rate / 100 / n, n * days / 365);
  }, [principal, rate, startDate, matDate, compFreq]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormInput label="Bank / Institution" placeholder="e.g. HDFC Bank"
          {...form.register("bankName")} error={form.formState.errors.bankName?.message as string} />
        <FormCurrencyInput label="Principal Amount (₹)" {...form.register("investedAmount")}
          error={form.formState.errors.investedAmount?.message as string} />
        <FormInput label="Interest Rate (% p.a.)" type="number" step="0.01"
          {...form.register("couponRate")} error={form.formState.errors.couponRate?.message as string} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="FD Start Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        <Controller control={form.control} name="maturityDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Maturity Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        <FormSelect label="Compounding" options={COMPOUND_FREQ} {...form.register("compoundingFrequency")} />
        {maturityAmt != null && (
          <div className="sm:col-span-2 lg:col-span-3 bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Estimated maturity amount</span>
            <span className="text-sm font-bold text-sky-400 tabular-nums">{formatCurrency(maturityAmt)}</span>
          </div>
        )}
        {accountOptions?.length > 0 && (
          <FormSelect label="Credit Maturity To"
            options={[{ value: "", label: "None" }, ...accountOptions]}
            {...form.register("linkedAccountId")} />
        )}
        {!isEditing && accountOptions?.length > 0 && (
          <FormSelect label="Debit from Account (optional)"
            options={[{ value: "", label: "None (no debit)" }, ...accountOptions]}
            {...form.register("debitAccountId")} />
        )}
        <FormInput label="Notes" {...form.register("notes")} />
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save FD" color="sky" />
    </form>
  );
}

// ─── Bond Form ────────────────────────────────────────────────────────────────

function BondForm({ defaultValues, onSubmit, onCancel, isPending, accountOptions, isEditing }: any) {
  const form = useForm({
    resolver: zodResolver(bondSchema),
    defaultValues: { couponFrequency: "HALF_YEARLY", quantity: "1", ...defaultValues },
  });
  const faceVal = Number(form.watch("faceValuePerBond") ?? 0);
  const qty     = Number(form.watch("quantity")          ?? 1);
  const rate    = Number(form.watch("couponRate")         ?? 0);
  const freq    = form.watch("couponFrequency") ?? "HALF_YEARLY";

  const totalInvested = faceVal > 0 && qty > 0 ? faceVal * qty : null;
  const couponAmt = useMemo(() => {
    if (!faceVal || !qty || !rate) return null;
    const n = freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "HALF_YEARLY" ? 2 : 1;
    return (faceVal * qty * rate / 100) / n;
  }, [faceVal, qty, rate, freq]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-3">
          <FormInput label="Bond Name" placeholder="e.g. RBI Savings Bond, Govt of India 7.26% 2032"
            {...form.register("companyName")} error={form.formState.errors.companyName?.message as string} />
        </div>
        <FormCurrencyInput label="Face Value per Bond (₹)" {...form.register("faceValuePerBond")}
          error={form.formState.errors.faceValuePerBond?.message as string} />
        <FormInput label="Quantity (no. of bonds)" type="number" min="1"
          {...form.register("quantity")} error={form.formState.errors.quantity?.message as string} />
        {totalInvested != null && (
          <div className="bg-muted/30 rounded-xl px-3 py-2.5 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground/80">Total invested</p>
            <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(totalInvested)}</p>
          </div>
        )}
        <FormInput label="Coupon Rate (% p.a.)" type="number" step="0.01"
          {...form.register("couponRate")} error={form.formState.errors.couponRate?.message as string} />
        <FormSelect label="Coupon Frequency" options={COUPON_FREQ} {...form.register("couponFrequency")} />
        <FormInput label="Credit Day of Month (1–31)" type="number" min="1" max="31"
          placeholder="e.g. 15"
          {...form.register("couponCreditDay")} />
        <Controller control={form.control} name="purchaseDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Purchase Date" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} error={fieldState.error?.message} />
        )} />
        <Controller control={form.control} name="maturityDate" render={({ field }) => (
          <FormDatePicker label="Maturity Date (optional)" value={field.value ?? ""} onChange={field.onChange}
            onBlur={field.onBlur} placeholder="Leave blank if perpetual" />
        )} />
        {couponAmt != null && (
          <div className="sm:col-span-2 lg:col-span-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Coupon income per {freq.toLowerCase().replace("_", "-")} period
            </span>
            <span className="text-sm font-bold text-violet-400 tabular-nums">{formatCurrency(couponAmt)}</span>
          </div>
        )}
        {accountOptions?.length > 0 && (
          <FormSelect label="Credit Coupons To"
            options={[{ value: "", label: "None" }, ...accountOptions]}
            {...form.register("linkedAccountId")} />
        )}
        {!isEditing && accountOptions?.length > 0 && (
          <FormSelect label="Debit from Account (optional)"
            options={[{ value: "", label: "None (no debit)" }, ...accountOptions]}
            {...form.register("debitAccountId")} />
        )}
        <FormInput label="Notes" {...form.register("notes")} />
      </div>
      <FormButtons onCancel={onCancel} isPending={isPending} label="Save Bond" color="violet" />
    </form>
  );
}

// ─── Tab Summary Bar ─────────────────────────────────────────────────────────

function TabSummaryBar({ investments, tab }: { investments: Investment[]; tab: TabId }) {
  const stats = useMemo(() => {
    if (investments.length === 0) return null;

    const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
    const totalCurrent  = investments.reduce((s, i) => s + i.currentValue,   0);
    const totalGain     = totalCurrent - totalInvested;
    const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const gainColor     = totalGain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
    const gainBg        = totalGain >= 0 ? "bg-emerald-500/12 border-emerald-500/15" : "bg-red-500/12 border-red-500/15";

    if (tab === "stocks") {
      return [
        { label: "Invested",       value: formatCurrency(totalInvested), color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Market Value",   value: formatCurrency(totalCurrent),  color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/12 border-indigo-500/15" },
        { label: "Gain / Loss",    value: `${totalGain >= 0 ? "+" : ""}${formatCurrency(totalGain)}`,    color: gainColor, bg: gainBg },
        { label: "Overall Return", value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,            color: gainColor, bg: gainBg },
        { label: "Holdings",       value: `${investments.length} stock${investments.length !== 1 ? "s" : ""}`,
          color: "text-foreground", bg: "bg-muted/60 border-border" },
      ];
    }

    if (tab === "mf") {
      const totalUnits = investments.reduce((s, i) => s + Number(i.units ?? 0), 0);
      return [
        { label: "Invested",       value: formatCurrency(totalInvested), color: "text-foreground",                     bg: "bg-muted/60 border-border" },
        { label: "Current Value",  value: formatCurrency(totalCurrent),  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Gain / Loss",    value: `${totalGain >= 0 ? "+" : ""}${formatCurrency(totalGain)}`,    color: gainColor, bg: gainBg },
        { label: "Overall Return", value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,            color: gainColor, bg: gainBg },
        { label: "Total Units",    value: `${totalUnits.toFixed(3)} u`,  color: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-500/12 border-indigo-500/15" },
      ];
    }

    if (tab === "gold") {
      // Sum grams as 24K equivalent so 18K and 22K grams aren't added to 24K grams raw
      const total24kEq = investments.reduce((s, i) => {
        const k = i.goldKarat ?? 22;
        return s + Number(i.quantityGrams ?? 0) * k / 24;
      }, 0);
      return [
        { label: "Invested",       value: formatCurrency(totalInvested), color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Market Value",   value: formatCurrency(totalCurrent),  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/12 border-amber-500/15" },
        { label: "Gain / Loss",    value: `${totalGain >= 0 ? "+" : ""}${formatCurrency(totalGain)}`,   color: gainColor, bg: gainBg },
        { label: "Overall Return", value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,           color: gainColor, bg: gainBg },
        { label: "24K Equivalent", value: `${total24kEq.toFixed(2)}g`,  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/12 border-amber-500/15" },
      ];
    }

    if (tab === "fd") {
      const totalPrincipal = investments.reduce((s, i) => s + i.investedAmount, 0);
      const totalMaturity  = investments.reduce((s, i) => s + (i.maturityAmount ?? i.investedAmount), 0);
      const totalAccrued   = investments.reduce((s, i) => s + (i.accruedInterest ?? 0), 0);
      const avgRate        = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
      const totalInterest  = totalMaturity - totalPrincipal;
      return [
        { label: "Total Principal",   value: formatCurrency(totalPrincipal),     color: "text-foreground",                     bg: "bg-muted/60 border-border" },
        { label: "Maturity Value",    value: formatCurrency(totalMaturity),       color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-500/12 border-sky-500/15" },
        { label: "Total Interest",    value: `+${formatCurrency(totalInterest)}`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Accrued So Far",    value: `+${formatCurrency(totalAccrued)}`,  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/15" },
        { label: "Avg Interest Rate", value: `${avgRate.toFixed(2)}% p.a.`,       color: "text-sky-600 dark:text-sky-400",         bg: "bg-sky-500/12 border-sky-500/15" },
      ];
    }

    if (tab === "bonds") {
      const avgCoupon    = investments.reduce((s, i) => s + (i.couponRate ?? 0), 0) / investments.length;
      const annualIncome = investments.reduce((s, i) => s + (i.investedAmount * (i.couponRate ?? 0) / 100), 0);
      return [
        { label: "Face Value",      value: formatCurrency(totalInvested),    color: "text-foreground",                   bg: "bg-muted/60 border-border" },
        { label: "Current Value",   value: formatCurrency(totalCurrent),     color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Annual Coupon",   value: formatCurrency(annualIncome),     color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Monthly Income",  value: formatCurrency(annualIncome / 12), color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/12 border-violet-500/15" },
        { label: "Avg Coupon Rate", value: `${avgCoupon.toFixed(2)}% p.a.`,  color: "text-foreground",                   bg: "bg-muted/60 border-border" },
      ];
    }

    return null;
  }, [investments, tab]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map(({ label, value, color, bg }) => (
        <div key={label} className={cn("rounded-2xl border p-4", bg)}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
          <p className={cn("text-sm font-bold tabular-nums leading-snug", color)}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Income badge helper ──────────────────────────────────────────────────────

function IncomeTypeBadge({ type }: { type: string }) {
  const cfg = type === "DIVIDEND"
    ? { label: "Dividend",  bg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" }
    : type === "BOND_COUPON"
    ? { label: "Coupon",    bg: "bg-violet-500/15 text-violet-400 border-violet-500/20" }
    : { label: "FD Mature", bg: "bg-sky-500/15    text-sky-400    border-sky-500/20"    };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

const INV_TYPE_LABELS: Record<string, string> = {
  STOCK: "Stocks", MUTUAL_FUND: "Mutual Funds", GOLD: "Gold", GOLD_ETF: "Gold ETF",
  FD: "Fixed Deposits", BOND: "Bonds", PPF: "PPF", NPS: "NPS", OTHER: "Other",
};

type IncomeFilter = "ALL" | "DIVIDEND" | "BOND_COUPON" | "FD_MATURITY";

function OverviewTab({ investments, year, onYearChange, incomeHistory }: {
  investments: Investment[]; year: number; onYearChange: (y: number) => void;
  incomeHistory: import("@/features/investments/types/investment.types").IncomeHistory | undefined;
}) {
  const chart          = useChartTheme();
  const currentYear    = new Date().getFullYear();
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("ALL");
  const [showAllIncome, setShowAllIncome] = useState(false);
  const INCOME_PAGE_SIZE = 10;

  const totalInvested = investments.reduce((s, i) => s + i.investedAmount, 0);
  const totalCurrent  = investments.reduce((s, i) => s + i.currentValue,   0);
  const totalGain     = totalCurrent - totalInvested;
  const gainPct       = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    investments.forEach(i => { map[i.investmentType] = (map[i.investmentType] ?? 0) + i.currentValue; });
    return Object.entries(map)
      .map(([type, val]) => ({ name: type, value: val, color: TAB_COLORS[type] ?? "#64748b" }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  if (investments.length === 0) return (
    <EmptyState icon={BarChart3} title="No investments yet"
      description="Add stocks, mutual funds, gold, FDs or bonds to see your portfolio overview." />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[
          { label: "Total Invested", value: formatCurrency(totalInvested), color: "text-foreground",     bg: "bg-muted/40" },
          { label: "Current Value",  value: formatCurrency(totalCurrent),  color: "text-indigo-400",     bg: "bg-indigo-500/12 border-indigo-500/15" },
          { label: "Total Gain",
            value: `${totalGain >= 0 ? "+" : ""}${formatCurrency(totalGain)}`,
            color: totalGain >= 0 ? "text-emerald-400" : "text-red-400",
            bg:    totalGain >= 0 ? "bg-emerald-500/12 border-emerald-500/15" : "bg-red-500/12 border-red-500/15" },
          { label: "Overall Return",
            value: `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,
            color: gainPct >= 0 ? "text-emerald-400" : "text-red-400",
            bg:    gainPct >= 0 ? "bg-emerald-500/12 border-emerald-500/15" : "bg-red-500/12 border-red-500/15" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-2xl border border-border p-4", bg)}>
            <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-1">{label}</p>
            <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </div>

      {byType.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Allocation by Instrument</h3>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Donut with center label */}
            <div className="relative w-48 shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} dataKey="value" stroke="none">
                    {byType.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={chart.tooltipStyle}
                    labelStyle={chart.labelStyle}
                    itemStyle={chart.itemStyle}
                    wrapperStyle={{ zIndex: 20 }}
                    formatter={(v: number, _: string, props: any) => [formatCurrency(v), INV_TYPE_LABELS[props?.payload?.name] ?? props?.payload?.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide">Portfolio</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(totalCurrent)}</p>
              </div>
            </div>
            {/* Legend with bars */}
            <div className="flex-1 space-y-2.5 w-full pt-1">
              {byType.map(s => {
                const pct = totalCurrent > 0 ? (s.value / totalCurrent) * 100 : 0;
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-xs font-medium text-foreground">
                          {INV_TYPE_LABELS[s.name] ?? s.name.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold tabular-nums" style={{ color: s.color }}>{pct.toFixed(1)}%</span>
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
        </div>
      )}

      {/* ── Income History ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Auto-Income History</h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Dividends, bond coupons and FD payouts credited automatically each evening
            </p>
          </div>
          <select
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="h-8 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500">
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Summary chips — clickable to filter */}
        {incomeHistory && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: "DIVIDEND"    as IncomeFilter, label: "Dividends",    value: incomeHistory.summary.dividendTotal,   color: "text-indigo-400",  ring: "ring-indigo-500/40",  bg: "bg-indigo-500/12 border-indigo-500/15"  },
              { key: "BOND_COUPON" as IncomeFilter, label: "Bond Coupon",  value: incomeHistory.summary.bondCouponTotal, color: "text-violet-400",  ring: "ring-violet-500/40",  bg: "bg-violet-500/12 border-violet-500/15"  },
              { key: "FD_MATURITY" as IncomeFilter, label: "FD Maturity",  value: incomeHistory.summary.fdMaturityTotal, color: "text-sky-400",     ring: "ring-sky-500/40",     bg: "bg-sky-500/12 border-sky-500/15"         },
              { key: "ALL"         as IncomeFilter, label: "Total Income", value: incomeHistory.summary.grandTotal,      color: "text-emerald-400", ring: "ring-emerald-500/40", bg: "bg-emerald-500/12 border-emerald-500/15" },
            ].map(({ key, label, value, color, ring, bg }) => (
              <button key={key} type="button" onClick={() => setIncomeFilter(k => k === key ? "ALL" : key)}
                className={cn(`rounded-xl border p-3 text-left transition-all`, bg,
                  incomeFilter === key && key !== "ALL" ? `ring-2 ${ring}` : "")}>
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-1 flex items-center gap-1">
                  {label}
                  {incomeFilter === key && key !== "ALL" && <span className="text-[8px] bg-current/20 px-1 rounded">active</span>}
                </p>
                <p className={`text-sm font-bold tabular-nums ${color}`}>{formatCurrency(value)}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filter pills */}
        {incomeHistory && incomeHistory.records.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground/80 font-medium">Filter:</span>
            {(["ALL", "DIVIDEND", "BOND_COUPON", "FD_MATURITY"] as IncomeFilter[]).map(f => (
              <button key={f} type="button" onClick={() => setIncomeFilter(f)}
                className={cn("h-6 px-2.5 rounded-lg text-xs font-medium transition-all border",
                  incomeFilter === f
                    ? f === "DIVIDEND"     ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400"
                    : f === "BOND_COUPON"  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                    : f === "FD_MATURITY"  ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                    :                        "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : "bg-muted/60 border-border text-muted-foreground/80 hover:text-foreground")}>
                {f === "ALL" ? "All" : f === "DIVIDEND" ? "Dividends" : f === "BOND_COUPON" ? "Coupons" : "FD Maturity"}
              </button>
            ))}
            {incomeFilter !== "ALL" && (
              <span className="text-xs text-muted-foreground/60">
                {(incomeHistory.records.filter(r => r.incomeType === incomeFilter)).length} records
              </span>
            )}
          </div>
        )}

        {/* Records list */}
        {(() => {
          const visibleRecords = incomeFilter === "ALL"
            ? (incomeHistory?.records ?? [])
            : (incomeHistory?.records.filter(r => r.incomeType === incomeFilter) ?? []);

          return incomeHistory && incomeHistory.records.length > 0 ? (
            visibleRecords.length > 0 ? (<>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Date</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Type</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Investment</th>
                      <th className="text-left text-xs text-muted-foreground/80 uppercase tracking-wide pb-2 pr-4">Account Credited</th>
                      <th className="text-right text-xs text-muted-foreground/80 uppercase tracking-wide pb-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllIncome ? visibleRecords : visibleRecords.slice(0, INCOME_PAGE_SIZE)).map((r: IncomeHistoryRecord, idx: number) => (
                      <tr key={r.id ?? `hist-${idx}`} className={cn(
                        "border-b border-border/60 last:border-0 transition-colors",
                        r.credited ? "hover:bg-muted/20" : "opacity-60 hover:opacity-80 hover:bg-muted/10"
                      )}>
                        <td className="py-2.5 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">{formatDate(r.eventDate)}</td>
                        <td className="py-2.5 pr-4 whitespace-nowrap"><IncomeTypeBadge type={r.incomeType} /></td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-foreground font-medium">{r.investmentName}</p>
                            {!r.investmentActive && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Sold</span>
                            )}
                          </div>
                          {r.symbol && <p className="text-xs text-muted-foreground/60">{r.symbol}</p>}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.credited
                            ? r.accountName
                              ? <span className="text-muted-foreground">{r.accountName}</span>
                              : <span className="text-muted-foreground/60 italic">Not linked</span>
                            : <span className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/50 italic">History</span>
                          }
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">
                          <span className={r.credited ? "text-emerald-400" : "text-muted-foreground/80"}>
                            {r.credited ? "+" : ""}{formatCurrency(r.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleRecords.length > INCOME_PAGE_SIZE && (
                <button onClick={() => setShowAllIncome(v => !v)}
                  className="w-full py-2.5 text-xs text-muted-foreground/80 hover:text-foreground flex items-center justify-center gap-1.5 transition-colors border-t border-border/60 mt-1">
                  {showAllIncome ? "Show less" : `Show all ${visibleRecords.length} records`}
                </button>
              )}
            </>) : (
              <p className="text-xs text-muted-foreground/80 text-center py-4">
                No {incomeFilter === "DIVIDEND" ? "dividend" : incomeFilter === "BOND_COUPON" ? "coupon" : "FD maturity"} records for {year}.
              </p>
            )
          ) : incomeHistory ? (
            <p className="text-xs text-muted-foreground/80 text-center py-6">
              No auto-income events recorded for {year}.
              {year === currentYear && " Income will appear here once the scheduler runs (8 PM IST daily)."}
            </p>
          ) : (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          );
        })()}

        <div className="flex items-start gap-2 pt-1">
          <Info className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground/80">
            Configure which account receives auto-income by setting a <strong className="text-muted-foreground">linked account</strong> when adding or editing each investment.
            Credited amounts also appear in that account&apos;s transaction history.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = "value_desc" | "gain_desc" | "gain_pct_desc" | "name_asc" | "date_desc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "value_desc",    label: "Value ↓" },
  { value: "gain_desc",     label: "Gain ↓" },
  { value: "gain_pct_desc", label: "Return % ↓" },
  { value: "name_asc",      label: "Name A–Z" },
  { value: "date_desc",     label: "Newest first" },
];

export default function InvestmentsPage() {
  const searchParams = useSearchParams();
  const [tab,       setTab]       = useState<TabId>("overview");

  // Sync tab from URL param on every navigation (e.g. /investments?tab=stocks)
  useEffect(() => {
    const p = searchParams.get("tab") as TabId | null;
    if (p && TABS.some(t => t.id === p)) setTab(p);
  }, [searchParams]);
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState<Investment | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [sortKey,   setSortKey]   = useState<SortKey>("value_desc");
  const [incomeYear, setIncomeYear] = useState(new Date().getFullYear());

  const { data: investments = [], isLoading } = useInvestments();
  const { data: goldPrice }                   = useGoldPrice();
  const { data: goldPriceInfo }               = useGoldPriceInfo();
  const { data: accounts = [] }               = useAccounts();
  const { data: incomeHistory }               = useIncomeHistory(incomeYear);

  const { mutate: create, isPending: creating } = useCreateInvestment();
  const { mutate: update, isPending: updating } = useUpdateInvestment();
  const { mutate: remove }                      = useDeleteInvestment();

  const accountOptions = useMemo(() =>
    accounts
      .filter((a: any) => a.accountType === "BANK_ACCOUNT")
      .map((a: any) => ({ value: a.id, label: a.name })),
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

  const buildPayload = useCallback((values: any, currentTab: TabId): CreateInvestmentPayload => {
    if (currentTab === "stocks") {
      const units = Number(values.units);
      const price = Number(values.avgBuyPrice);
      return {
        investmentType: "STOCK",
        symbol: values.symbol, companyName: values.name ?? values.companyName, exchange: values.exchange ?? "NSE",
        units, avgBuyPrice: price, currentPrice: price,
        investedAmount: units * price, currentValue: units * price,
        purchaseDate: values.purchaseDate,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
        notes: values.notes,
      };
    }
    if (currentTab === "mf") {
      const units = Number(values.units);
      const nav   = Number(values.avgBuyPrice);
      return {
        investmentType: "MUTUAL_FUND",
        schemeCode: values.schemeCode, companyName: values.name ?? values.companyName,
        units, avgBuyPrice: nav, currentPrice: nav,
        investedAmount: units * nav, currentValue: units * nav,
        purchaseDate: values.purchaseDate,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
      };
    }
    if (currentTab === "gold") {
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
        notes: values.notes,
      };
    }
    if (currentTab === "fd") {
      const principal = Number(values.investedAmount);
      return {
        investmentType: "FD", bankName: values.bankName,
        investedAmount: principal, currentValue: principal,
        couponRate: Number(values.couponRate), compoundingFrequency: values.compoundingFrequency,
        purchaseDate: values.purchaseDate, maturityDate: values.maturityDate,
        linkedAccountId: values.linkedAccountId || undefined,
        debitAccountId: values.debitAccountId || undefined,
        notes: values.notes,
      };
    }
    // bonds
    const faceVal = Number(values.faceValuePerBond);
    const qty     = Number(values.quantity);
    const total   = faceVal * qty;
    return {
      investmentType: "BOND", companyName: values.companyName,
      investedAmount: total, currentValue: total,
      units: qty, avgBuyPrice: faceVal,
      couponRate: Number(values.couponRate), couponFrequency: values.couponFrequency,
      couponCreditDay: values.couponCreditDay ? Number(values.couponCreditDay) : undefined,
      purchaseDate: values.purchaseDate,
      maturityDate: values.maturityDate || undefined,
      linkedAccountId: values.linkedAccountId || undefined,
      debitAccountId: values.debitAccountId || undefined,
      notes: values.notes,
    };
  }, [goldPrice]);

  const handleSubmit = useCallback((values: any) => {
    const payload = buildPayload(values, tab);
    if (editItem) {
      update({ id: editItem.id, payload }, { onSuccess: () => { setEditItem(null); setShowForm(false); } });
    } else {
      create(payload, { onSuccess: () => setShowForm(false) });
    }
  }, [editItem, create, update, buildPayload, tab]);

  const editDefaults = useCallback((inv: Investment) => {
    const base = { linkedAccountId: inv.linkedAccountId, notes: inv.notes };
    if (inv.investmentType === "FD")
      return { ...base, bankName: inv.bankName, investedAmount: inv.investedAmount,
        couponRate: inv.couponRate, purchaseDate: inv.purchaseDate,
        maturityDate: inv.maturityDate, compoundingFrequency: inv.compoundingFrequency };
    if (inv.investmentType === "BOND")
      return { ...base, companyName: inv.companyName,
        faceValuePerBond: inv.avgBuyPrice,          // stored as avgBuyPrice (per bond)
        quantity: inv.units,
        couponRate: inv.couponRate, couponFrequency: inv.couponFrequency,
        couponCreditDay: inv.couponCreditDay,
        purchaseDate: inv.purchaseDate, maturityDate: inv.maturityDate };
    if (inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF")
      return { companyName: inv.companyName, quantityGrams: inv.quantityGrams,
        goldKarat: inv.goldKarat ?? 22,
        avgBuyPrice: inv.avgBuyPrice, purchaseDate: inv.purchaseDate, notes: inv.notes };
    if (inv.investmentType === "MUTUAL_FUND")
      return { ...base, units: inv.units, avgBuyPrice: inv.avgBuyPrice, purchaseDate: inv.purchaseDate };
    // STOCK
    return { ...base, units: inv.units, avgBuyPrice: inv.avgBuyPrice, purchaseDate: inv.purchaseDate };
  }, []);

  const switchToTab = useCallback((inv: Investment): TabId => {
    if (inv.investmentType === "STOCK")        return "stocks";
    if (inv.investmentType === "MUTUAL_FUND")  return "mf";
    if (inv.investmentType === "GOLD" || inv.investmentType === "GOLD_ETF") return "gold";
    if (inv.investmentType === "FD")           return "fd";
    return "bonds";
  }, []);

  const canAdd = tab !== "overview";

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

  return (
    <div className="flex flex-col flex-1">
      <Header title="Investments" />

      {confirmId && (
        <ConfirmDialog open title="Remove Investment"
          description="This investment will be removed from your portfolio."
          confirmLabel="Remove" danger
          onConfirm={() => { remove(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}

      {(showForm || editItem) && canAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeForm}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">
                {editItem ? "Edit" : "New"} {TABS.find(t => t.id === tab)?.label.replace(/s$/, "")}
              </h3>
              <button onClick={closeForm} className="text-muted-foreground/80 hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {tab === "stocks" && (
              <StockForm
                defaultValues={editItem ? editDefaults(editItem) : undefined}
                editStock={editItem?.investmentType === "STOCK" ? editItem : null}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} accountOptions={accountOptions}
                isEditing={!!editItem} />
            )}
            {tab === "mf" && (
              <MFForm
                defaultValues={editItem ? editDefaults(editItem) : undefined}
                editMF={editItem?.investmentType === "MUTUAL_FUND" ? editItem : null}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} accountOptions={accountOptions}
                isEditing={!!editItem} />
            )}
            {tab === "gold" && (
              <GoldForm
                defaultValues={editItem ? editDefaults(editItem) : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} goldPrice={goldPrice}
                accountOptions={accountOptions} isEditing={!!editItem} />
            )}
            {tab === "fd" && (
              <FDForm
                defaultValues={editItem ? editDefaults(editItem) : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} accountOptions={accountOptions}
                isEditing={!!editItem} />
            )}
            {tab === "bonds" && (
              <BondForm
                defaultValues={editItem ? editDefaults(editItem) : undefined}
                onSubmit={handleSubmit} onCancel={closeForm}
                isPending={creating || updating} accountOptions={accountOptions}
                isEditing={!!editItem} />
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4">
        {/* Tabs + Add button in one row */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 overflow-x-auto pb-0 flex-1 min-w-0" style={{ scrollbarWidth: "none" }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id}
                onClick={() => { setTab(id); closeForm(); }}
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  tab === id ? "bg-indigo-600 text-white" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
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
          {canAdd && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 transition-all shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Add {TABS.find(t => t.id === tab)?.label.replace(/s$/, "")}
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-44 bg-muted/40 rounded-2xl animate-pulse" />)}
          </div>
        ) : tab === "overview" ? (
          <OverviewTab investments={investments} year={incomeYear} onYearChange={setIncomeYear} incomeHistory={incomeHistory} />
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
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Live Gold Rates</p>
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
                        {val ? `₹${Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 })}/g` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground/80">{filtered.length} holding{filtered.length !== 1 ? "s" : ""}</p>
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                className="h-8 px-2 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500">
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(inv => (
                <InvestmentCard key={inv.id} inv={inv}
                  onEdit={() => { setTab(switchToTab(inv)); setEditItem(inv); setShowForm(true); }}
                  onDelete={() => setConfirmId(inv.id)}
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
    </div>
  );
}
