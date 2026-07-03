"use client";

import { useState, useMemo } from "react";
import {
  Wallet, TrendingUp, Receipt, Banknote, BarChart2, ChevronLeft, ChevronRight,
  Target, Trophy, Sparkles, ArrowUpRight, ArrowDownRight, Plus, MinusCircle,
  X, ArrowLeftRight, Building2, CreditCard, RefreshCw, Lightbulb, Bell,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/shared/StatCard";
import { StatCardSkeleton } from "@/components/shared/LoadingSkeleton";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormInput } from "@/components/forms/FormInput";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import { useGoals }    from "@/features/goals/hooks/useGoals";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useCreateExpense, useExpenses } from "@/features/expenses/hooks/useExpenses";
import { useCreateIncome } from "@/features/income/hooks/useIncome";
import { useTransfer } from "@/features/accounts/hooks/useAccounts";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatCurrencyCompact, formatCurrency, formatDate, getGreeting, cn } from "@/lib/utils";
import { INCOME_SOURCES, INCOME_SOURCE_ICONS } from "@/lib/constants";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function txnLabel(type: string, label: string, description?: string): string {
  if (description) return description;
  if (type === "INCOME") {
    const src = INCOME_SOURCES.find(s => s.value === label);
    return src ? src.label : label;
  }
  return label;
}

const TXN_COLORS: Record<string, string> = {
  INCOME:       "text-emerald-500 dark:text-emerald-400",
  EXPENSE:      "text-red-500 dark:text-red-400",
  TRANSFER_IN:  "text-indigo-500 dark:text-indigo-400",
  TRANSFER_OUT: "text-amber-500 dark:text-amber-400",
};
const TXN_SIGNS: Record<string, string> = {
  INCOME: "+", EXPENSE: "−", TRANSFER_IN: "+", TRANSFER_OUT: "−",
};
const TXN_BG: Record<string, string> = {
  INCOME: "bg-emerald-500/10", EXPENSE: "bg-red-500/10",
  TRANSFER_IN: "bg-indigo-500/10", TRANSFER_OUT: "bg-amber-500/10",
};

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ current, previous, inverse = false, title }: { current: number; previous?: number; inverse?: boolean; title?: string }) {
  if (previous == null || Math.abs(previous) < 1) return null;
  const delta = current - previous;
  const pct   = Math.abs((delta / previous) * 100);
  if (pct > 500) return null;
  const up   = delta >= 0;
  const good = inverse ? !up : up;
  return (
    <span title={title} className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
      good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
      {up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {pct.toFixed(0)}%
    </span>
  );
}

// ─── Quick-add modals ─────────────────────────────────────────────────────────

type QuickModal = "none" | "expense" | "income" | "transfer";

function QuickModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function QuickExpenseModal({ accounts, categories, onClose }: {
  accounts:   { id: string; name: string; accountType: string; currentBalance: number }[];
  categories: { id: string; name: string }[];
  onClose:    () => void;
}) {
  const now = new Date();
  const { mutate: createExpense, isPending } = useCreateExpense();
  const [payChannel, setPayChannel] = useState<"" | "CASH" | "ACCOUNT" | "CREDIT">("");

  const cashAccounts   = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts   = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const creditAccounts = accounts.filter(a => a.accountType === "CREDIT_CARD");

  const form = useForm({ defaultValues: {
    accountId: "", categoryId: "", amount: 0, description: "", expenseDate: now.toISOString().split("T")[0],
  }});

  const channelList = payChannel === "CASH" ? cashAccounts : payChannel === "ACCOUNT" ? bankAccounts : payChannel === "CREDIT" ? creditAccounts : [];
  const accountOptions  = channelList.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));

  const handleChannel = (ch: "CASH" | "ACCOUNT" | "CREDIT") => {
    setPayChannel(ch);
    form.setValue("accountId", "");
    const list = ch === "CASH" ? cashAccounts : ch === "ACCOUNT" ? bankAccounts : creditAccounts;
    if (list.length === 1) form.setValue("accountId", list[0].id);
  };

  const hasAccounts = accounts.length > 0;

  const onSubmit = (v: any) => {
    const account = accounts.find(a => a.id === v.accountId);
    const paymentMethod = account?.accountType === "CASH_WALLET" ? "CASH"
      : account?.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK_ACCOUNT";
    createExpense({ accountId: v.accountId, categoryId: v.categoryId,
      amount: Number(v.amount), description: v.description || undefined,
      expenseDate: v.expenseDate, paymentMethod },
      { onSuccess: () => { toast.success("Expense added"); onClose(); } });
  };

  return (
    <QuickModalShell title="Quick Add Expense" onClose={onClose}>
      {!hasAccounts ? (
        <div className="py-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">You need at least one account to add expenses.</p>
          <a href="/accounts" onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-colors">
            Set up an account →
          </a>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormSelect label="Category" options={categoryOptions} placeholder="Select category"
            error={form.formState.errors.categoryId?.message} {...form.register("categoryId", { required: "Select a category" })} />
          <FormCurrencyInput label="Amount" placeholder="0"
            error={form.formState.errors.amount?.message} {...form.register("amount", { required: true, min: 0.01 })} />
          <Controller control={form.control} name="expenseDate" render={({ field }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <FormInput label="Description (optional)" placeholder="e.g. Grocery shopping" {...form.register("description")} />

          {/* Payment channel — required */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground">Paid Via</p>
              <span className="text-red-500 text-xs">*</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {cashAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannel("CASH")}
                  className={cn("flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "CASH" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "bg-muted border-border text-muted-foreground")}>
                  <Banknote className="w-3 h-3" /> Cash
                </button>
              )}
              {bankAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannel("ACCOUNT")}
                  className={cn("flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "ACCOUNT" ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "bg-muted border-border text-muted-foreground")}>
                  <Building2 className="w-3 h-3" /> Bank
                </button>
              )}
              {creditAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannel("CREDIT")}
                  className={cn("flex items-center gap-1 px-2.5 h-7 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "CREDIT" ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400" : "bg-muted border-border text-muted-foreground")}>
                  <CreditCard className="w-3 h-3" /> Credit
                </button>
              )}
            </div>
            {payChannel !== "" && accountOptions.length > 1 && (
              <FormSelect label="" options={accountOptions} placeholder="Select account"
                error={form.formState.errors.accountId?.message}
                {...form.register("accountId", { required: "Select an account" })} />
            )}
            {form.formState.isSubmitted && !form.watch("accountId") && payChannel === "" && (
              <p className="text-xs text-red-500">Please select how this expense was paid</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={isPending}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-60">
              {isPending ? "Saving…" : "Add Expense"}
            </button>
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
          </div>
        </form>
      )}
    </QuickModalShell>
  );
}

function QuickIncomeModal({ accounts, onClose }: {
  accounts: { id: string; name: string; accountType: string; currentBalance: number }[];
  onClose:  () => void;
}) {
  const now = new Date();
  const { mutate: createIncome, isPending } = useCreateIncome();
  const form = useForm({ defaultValues: {
    accountId: "", source: "SALARY", amount: 0, description: "", incomeDate: now.toISOString().split("T")[0],
  }});

  const nonCreditAccounts = accounts.filter(a => a.accountType !== "CREDIT_CARD");
  const accountOptions    = nonCreditAccounts.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const sourceOptions     = INCOME_SOURCES;

  const onSubmit = (v: any) => {
    const account = accounts.find(a => a.id === v.accountId);
    const d = new Date(v.incomeDate);
    createIncome({ accountId: v.accountId || undefined,
      source: v.source as any,
      paymentMode: account?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT",
      amount: Number(v.amount), description: v.description || undefined,
      incomeDate: v.incomeDate, periodMonth: d.getMonth() + 1, periodYear: d.getFullYear() },
      { onSuccess: () => { toast.success("Income recorded"); onClose(); } });
  };

  return (
    <QuickModalShell title="Quick Add Income" onClose={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormSelect label="Credit To" options={accountOptions} placeholder="Select account"
          error={form.formState.errors.accountId?.message} {...form.register("accountId", { required: "Select an account" })} />
        <FormSelect label="Source" options={sourceOptions} placeholder="Select source"
          error={form.formState.errors.source?.message} {...form.register("source", { required: "Select a source" })} />
        <FormCurrencyInput label="Amount" placeholder="0"
          error={form.formState.errors.amount?.message} {...form.register("amount", { required: true, min: 0.01 })} />
        <Controller control={form.control} name="incomeDate" render={({ field }) => (
          <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
        )} />
        <FormInput label="Description (optional)" placeholder="e.g. June salary" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60">
            {isPending ? "Saving…" : "Add Income"}
          </button>
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
        </div>
      </form>
    </QuickModalShell>
  );
}

function QuickTransferModal({ accounts, onClose }: {
  accounts: { id: string; name: string; accountType: string; currentBalance: number }[];
  onClose:  () => void;
}) {
  const now = new Date();
  const { mutate: doTransfer, isPending } = useTransfer();
  const form = useForm({ defaultValues: {
    fromAccountId: "", toAccountId: "", amount: 0, description: "", transferDate: now.toISOString().split("T")[0],
  }});

  const allOptions    = accounts.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const creditOptions = accounts.filter(a => a.accountType === "CREDIT_CARD").map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)} due` }));
  const fromOptions   = accounts.filter(a => a.accountType !== "CREDIT_CARD").map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const toOptions     = [...allOptions.filter(o => accounts.find(a => a.id === o.value)?.accountType !== "CREDIT_CARD"), ...creditOptions];

  const onSubmit = (v: any) => {
    if (v.fromAccountId === v.toAccountId) { form.setError("toAccountId", { message: "Cannot transfer to same account" }); return; }
    doTransfer({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId,
      amount: Number(v.amount), description: v.description || undefined, transferDate: v.transferDate },
      { onSuccess: () => { toast.success("Transfer complete"); onClose(); } });
  };

  return (
    <QuickModalShell title="Quick Transfer" onClose={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormSelect label="From" options={fromOptions}
          placeholder="Source account"
          error={form.formState.errors.fromAccountId?.message} {...form.register("fromAccountId", { required: "Select source" })} />
        <FormSelect label="To" options={toOptions} placeholder="Destination account"
          error={(form.formState.errors.toAccountId as any)?.message} {...form.register("toAccountId", { required: "Select destination" })} />
        <FormCurrencyInput label="Amount" placeholder="0"
          error={form.formState.errors.amount?.message} {...form.register("amount", { required: true, min: 0.01 })} />
        <Controller control={form.control} name="transferDate" render={({ field }) => (
          <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
        )} />
        <FormInput label="Note (optional)" placeholder="e.g. Bill payment" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
            {isPending ? "Processing…" : "Transfer"}
          </button>
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
        </div>
      </form>
    </QuickModalShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quickModal, setQuickModal] = useState<QuickModal>("none");
  const initYear  = now.getFullYear();
  const initMonth = now.getMonth() + 1;
  const budgetDismissKey = `overBudgetDismissed_${initYear}_${initMonth}`;
  const [overBudgetDismissed, setOverBudgetDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(budgetDismissKey) === "true";
  });
  const [showAllBills, setShowAllBills] = useState(false);

  // Previous month for comparison
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYearNum  = month === 1 ? year - 1 : year;

  const { data, isLoading }           = useDashboard(year, month);
  const { data: prevData }            = useDashboard(prevYearNum, prevMonthNum);
  const { data: walletAccounts = [] } = useAccounts();
  const { data: goals = [] }          = useGoals();
  const { data: categories = [] }     = useCategories("EXPENSE");
  const chart                         = useChartTheme();

  // Upcoming recurring bills in next 7 days
  const todayStr = now.toISOString().split("T")[0];
  const next7    = new Date(now); next7.setDate(now.getDate() + 7);
  const next7Str = next7.toISOString().split("T")[0];
  const { data: recurringPage } = useExpenses({ recurring: true, startDate: todayStr, endDate: next7Str, size: 10 });
  const upcomingBills = recurringPage?.data ?? [];

  const cashBalance      = walletAccounts.filter(a => a.accountType === "CASH_WALLET")   .reduce((s, a) => s + a.currentBalance, 0);
  const bankBalance      = walletAccounts.filter(a => a.accountType === "BANK_ACCOUNT")  .reduce((s, a) => s + a.currentBalance, 0);
  const creditCardDebt   = walletAccounts.filter(a => a.accountType === "CREDIT_CARD")   .reduce((s, a) => s + Math.max(0, a.currentBalance), 0);
  const totalAccountBalance = cashBalance + bankBalance;

  // Deduplicate transactions (transfers appear on both from & to accounts) and attach account name
  const recentTransactions = useMemo(() => {
    const seen = new Set<string>();
    return walletAccounts
      .flatMap(a => a.recentTransactions.map(t => ({ ...t, accountName: a.name })))
      .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [walletAccounts]);

  const todaySpending = useMemo(() => {
    const seen = new Set<string>();
    return walletAccounts
      .flatMap(a => a.recentTransactions)
      .filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return t.type === "EXPENSE" && t.date.startsWith(todayStr);
      })
      .reduce((s, t) => s + t.amount, 0);
  }, [walletAccounts]);

  const completedGoals = goals.filter(g => g.savedAmount >= g.targetAmount);
  const totalTarget    = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.savedAmount,  0);
  const goalsPct       = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const trend = data?.monthlyTrend ?? [];
  const hasInvestments = data && (data.totalInvested > 0 || data.totalInvestmentValue > 0);

  // Smart insights: find top 3 categories with biggest month-over-month spend change
  const smartInsights = useMemo(() => {
    if (!data?.categoryBreakdown?.length || !prevData?.categoryBreakdown?.length) return [];
    const prevMap = new Map((prevData.categoryBreakdown as any[]).map((c: any) => [c.categoryId, c.amount ?? 0]));
    const avgMonthlySpend = data.monthlyExpenses > 0 ? data.monthlyExpenses : 5000;
    const threshold = Math.max(100, avgMonthlySpend * 0.05);
    const deltas: { category: string; delta: number }[] = [];
    for (const c of data.categoryBreakdown as any[]) {
      const prev = prevMap.get(c.categoryId) ?? 0;
      const delta = (c.amount ?? 0) - prev;
      if (Math.abs(delta) >= threshold) deltas.push({ category: c.categoryName, delta });
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return deltas.slice(0, 3);
  }, [data, prevData]);

  // Net cash flow
  const netCashFlow = data ? data.monthlyIncome - data.monthlyExpenses : 0;

  // Trend percent for stat cards
  const incomeTrend  = prevData && prevData.monthlyIncome  > 0 ? ((data?.monthlyIncome  ?? 0) - prevData.monthlyIncome)  / prevData.monthlyIncome  * 100 : undefined;
  const expenseTrend = prevData && prevData.monthlyExpenses > 0 ? ((data?.monthlyExpenses ?? 0) - prevData.monthlyExpenses) / prevData.monthlyExpenses * 100 : undefined;

  return (
    <div className="flex flex-col flex-1 bg-background">
      <Header title="Dashboard" />

      {/* Quick-add modals */}
      {quickModal === "expense" && (
        <QuickExpenseModal accounts={walletAccounts} categories={categories} onClose={() => setQuickModal("none")} />
      )}
      {quickModal === "income" && (
        <QuickIncomeModal accounts={walletAccounts} onClose={() => setQuickModal("none")} />
      )}
      {quickModal === "transfer" && (
        <QuickTransferModal accounts={walletAccounts} onClose={() => setQuickModal("none")} />
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4 lg:space-y-5">

        {/* ── Greeting + Month Navigator ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Good {getGreeting()}, {user?.fullName?.split(" ")[0]} 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Your financial summary for {monthLabel(year, month)}.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs font-semibold text-foreground min-w-24 text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigate(1)} disabled={isCurrentMonth}
              className={cn("w-8 h-8 rounded-lg border flex items-center justify-center transition-all",
                isCurrentMonth ? "bg-muted/40 border-border/40 cursor-not-allowed opacity-40" : "bg-muted hover:bg-muted/80 border-border")}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setQuickModal("expense")} disabled={walletAccounts.length === 0}
            title={walletAccounts.length === 0 ? "Add an account first" : undefined}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-40">
            <MinusCircle className="w-4 h-4" /> Add Expense
          </button>
          <button onClick={() => setQuickModal("income")} disabled={walletAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0}
            title={walletAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0 ? "Add an account first" : undefined}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-40">
            <Plus className="w-4 h-4" /> Add Income
          </button>
          <button onClick={() => setQuickModal("transfer")} disabled={walletAccounts.length < 2}
            title={walletAccounts.length < 2 ? "You need at least 2 accounts to transfer" : undefined}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40">
            <ArrowLeftRight className="w-4 h-4" /> Transfer
          </button>
          <Link href="/accounts"
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 border border-border text-foreground transition-all">
            <Wallet className="w-4 h-4" /> Accounts
          </Link>
          <Link href="/expenses"
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 border border-border text-foreground transition-all">
            <Receipt className="w-4 h-4" /> Transactions
          </Link>
        </div>

        {/* ── Onboarding: new user with no accounts ── */}
        {!isLoading && walletAccounts.length === 0 && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Welcome to WealthyNest!</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get started in 3 simple steps to track your finances.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Link href="/accounts" className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Add an Account</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Bank, cash, or credit card</p>
                </div>
              </Link>
              <Link href="/expenses" className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Log Expenses</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Track where your money goes</p>
                </div>
              </Link>
              <Link href="/budgets" className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Set a Budget</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Stay on top of your limits</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ── Smart Insight + Upcoming Bills ── */}
        {(smartInsights.length > 0 || upcomingBills.length > 0) && (
          <div className="grid md:grid-cols-2 gap-3">

            {/* Smart Insights */}
            {smartInsights.length > 0 && (
              <div className="rounded-2xl border bg-card border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs font-semibold text-foreground">Smart Insights</p>
                </div>
                {smartInsights.map((insight, i) => (
                  <div key={i} className={cn("flex items-center gap-2 rounded-xl px-3 py-2",
                    insight.delta > 0 ? "bg-amber-500/8" : "bg-emerald-500/8")}>
                    <span className={cn("text-xs font-semibold shrink-0 tabular-nums",
                      insight.delta > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {insight.delta > 0 ? "+" : ""}{formatCurrency(insight.delta)}
                    </span>
                    <p className="text-xs text-muted-foreground leading-snug min-w-0 truncate">
                      on <span className="font-semibold text-foreground">{insight.category}</span> vs last month
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming Recurring Bills */}
            {upcomingBills.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-3.5 h-3.5 text-violet-500" />
                  <p className="text-xs font-semibold text-foreground">Upcoming Bills — Next 7 Days</p>
                </div>
                <div className="space-y-2">
                  {(showAllBills ? upcomingBills : upcomingBills.slice(0, 4)).map((bill: import("@/features/expenses/types/expense.types").Expense) => {
                    const d = new Date(bill.expenseDate);
                    const dayName = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
                    return (
                      <div key={bill.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <RefreshCw className="w-3 h-3 text-violet-600 dark:text-violet-400 shrink-0" />
                          <span className="text-xs text-foreground truncate">{bill.description || bill.categoryName || "Recurring"}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums">−{formatCurrency(bill.amount)}</p>
                          <p className="text-xs text-muted-foreground/80">{dayName}</p>
                        </div>
                      </div>
                    );
                  })}
                  {upcomingBills.length > 4 && (
                    <button onClick={() => setShowAllBills(v => !v)}
                      className="text-xs text-violet-500 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 pt-1 transition-colors">
                      {showAllBills ? "Show less" : `+${upcomingBills.length - 4} more`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {isLoading ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />) : (
            <>
              <StatCard title="Net Worth"      subtitle="total"
                icon={Wallet}    iconColor="text-indigo-500 dark:text-indigo-400"   iconBg="bg-indigo-500/10"
                value={data ? formatCurrency(data.totalNetWorth) : "—"} />
              <StatCard title="Investments"   subtitle="current value"
                icon={BarChart2} iconColor="text-violet-500 dark:text-violet-400"   iconBg="bg-violet-500/10"
                value={data ? formatCurrency(data.totalInvestmentValue) : "—"} />
              <StatCard title="Income"         subtitle={monthLabel(year, month)}
                icon={Banknote}  iconColor="text-emerald-500 dark:text-emerald-400" iconBg="bg-emerald-500/10"
                value={data ? formatCurrency(data.monthlyIncome) : "—"}
                trend={incomeTrend} />
              <StatCard title="Expenses"       subtitle={monthLabel(year, month)}
                icon={Receipt}   iconColor="text-red-500 dark:text-red-400"         iconBg="bg-red-500/10"
                value={data ? formatCurrency(data.monthlyExpenses) : "—"}
                trend={expenseTrend !== undefined ? -expenseTrend : undefined} />
              <StatCard title="Today's Spending"
                subtitle={data && data.monthlyExpenses > 0 ? `vs ${formatCurrencyCompact(Math.round(data.monthlyExpenses / new Date(year, month, 0).getDate()))} avg/day` : "today"}
                icon={TrendingUp} iconColor="text-blue-500 dark:text-blue-400" iconBg="bg-blue-500/10"
                value={formatCurrency(todaySpending)} />
            </>
          )}
        </div>

        {/* ── Savings Rate + Net Cash Flow ── */}
        {data && data.savingsRate != null && data.monthlyIncome > 0 && (
          <div className={cn("rounded-2xl border p-4 flex items-center gap-4",
            data.savingsRate >= 20 ? "bg-emerald-500/8 border-emerald-500/20"
              : data.savingsRate > 0 ? "bg-amber-500/8 border-amber-500/20"
              : "bg-red-500/8 border-red-500/20")}>
            <Sparkles className={cn("w-5 h-5 shrink-0",
              data.savingsRate >= 20 ? "text-emerald-500" : data.savingsRate > 0 ? "text-amber-500" : "text-red-500")} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Savings Rate — {monthLabel(year, month)}</p>
              <p className={cn("text-2xl font-bold tabular-nums",
                data.savingsRate >= 20 ? "text-emerald-500 dark:text-emerald-400"
                  : data.savingsRate > 0 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400")}>
                {data.savingsRate.toFixed(1)}%
              </p>
              {prevData && prevData.savingsRate != null && (
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  vs {prevData.savingsRate.toFixed(1)}% last month
                </p>
              )}
            </div>
            <div className="text-right shrink-0 space-y-1">
              <div>
                <p className="text-xs text-muted-foreground">Net cash flow</p>
                <p className={cn("text-base font-bold tabular-nums",
                  netCashFlow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {netCashFlow >= 0 ? "+" : ""}{formatCurrency(netCashFlow)}
                </p>
              </div>
              {prevData && (
                <DeltaBadge current={netCashFlow} previous={prevData.monthlyIncome - prevData.monthlyExpenses} title="vs last month" />
              )}
            </div>
          </div>
        )}

        {/* ── Wallet Overview ── */}
        {walletAccounts.length > 0 && (
          <Link href="/accounts" className="block group">
            <div className="bg-gradient-to-r from-indigo-600/10 to-violet-600/8 border border-indigo-500/20 hover:border-indigo-500/40 rounded-2xl p-4 transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wallet Overview</p>
                </div>
                <span className="text-xs text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 font-medium transition-colors">View all →</span>
              </div>
              {/* tile count: Total + Bank + Cash always + conditional credit debt */}
              {(() => {
                const n = 3 + (creditCardDebt > 0 ? 1 : 0);
                const cls = n <= 3 ? "grid-cols-2 md:grid-cols-3" : n === 4 ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";
                return <div className={cn("grid gap-3", cls)}>
                <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold text-foreground tabular-nums">{formatCurrency(totalAccountBalance)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Cash &amp; bank</p>
                </div>
                <div className="bg-violet-500/8 border border-violet-500/15 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Bank</p>
                  <p className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">{formatCurrency(bankBalance)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Savings / salary</p>
                </div>
                <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Cash</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(cashBalance)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">In wallet</p>
                </div>
                {creditCardDebt > 0 && (
                  <div className="bg-rose-500/8 border border-rose-500/20 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Card Debt</p>
                    <p className="text-base font-bold text-rose-500 dark:text-rose-400 tabular-nums">{formatCurrency(creditCardDebt)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Outstanding</p>
                  </div>
                )}
              </div>;
              })()}
            </div>
          </Link>
        )}

        {/* ── Over-budget Alert ── */}
        {!overBudgetDismissed && data?.budgetSummaries?.some(b => b.overBudget) && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
            <span className="text-amber-500 text-base shrink-0">⚠️</span>
            <p className="flex-1 text-sm text-amber-700 dark:text-amber-300 font-medium">
              {(() => {
                const count = data.budgetSummaries.filter(b => b.overBudget).length;
                return `You have ${count} budget${count > 1 ? "s" : ""} over limit this month.`;
              })()}
            </p>
            <button onClick={() => {
                const key = `overBudgetDismissed_${year}_${month}`;
                setOverBudgetDismissed(true);
                localStorage.setItem(key, "true");
              }}
              className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Charts Row ── */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Budget Progress */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-foreground text-sm">Budget Progress</h3>
              <Link href="/budgets"
                className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-500/8 transition-all">
                See all →
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : data?.budgetSummaries?.length ? (
              <div className="space-y-4">
                {data.budgetSummaries.slice(0, 6).map((b) => {
                  const color = b.categoryColor ?? "#6366f1";
                  return (
                    <div key={b.categoryId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs text-foreground font-medium truncate">{b.categoryName}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground">
                            <CurrencyDisplay amount={b.spent} size="sm" color="muted" />
                            {" / "}
                            <CurrencyDisplay amount={b.budgeted} size="sm" color="muted" />
                          </span>
                          <span className={cn("text-xs font-semibold w-9 text-right tabular-nums",
                            b.overBudget ? "text-red-500 dark:text-red-400" : b.percentUsed > 80 ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground")}>
                            {b.percentUsed.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all",
                          b.overBudget ? "bg-red-500" : b.percentUsed > 80 ? "bg-amber-500" : "bg-indigo-500")}
                          style={{ width: `${Math.min(100, b.percentUsed)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-muted-foreground">No budgets set for this month</p>
                <Link href="/budgets" className="mt-3 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors">
                  Set up budgets →
                </Link>
              </div>
            )}
          </div>

          {/* Spending Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Spending Breakdown</h3>
              <Link href="/expenses"
                className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-500/8 transition-all">
                See all →
              </Link>
            </div>
            {data?.categoryBreakdown?.length ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={data.categoryBreakdown} cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="amount">
                      {data.categoryBreakdown.map((c) => (
                        <Cell key={c.categoryId} fill={c.categoryColor ?? "#6366f1"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chart.tooltipStyle}
                      labelStyle={chart.labelStyle}
                      itemStyle={chart.itemStyle}
                      formatter={(v: number, _: string, props: any) => [
                        formatCurrency(v), props?.payload?.categoryName ?? "Amount"
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5 flex-1 overflow-y-auto max-h-36">
                  {data.categoryBreakdown.map((c) => (
                    <div key={c.categoryId} className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.categoryColor ?? "#6366f1" }} />
                        <span className="text-xs text-muted-foreground truncate">{c.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground/70 tabular-nums">{formatCurrency(c.amount)}</span>
                        <span className="text-xs font-semibold text-foreground w-9 text-right tabular-nums">{c.percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-8 gap-2">
                <p className="text-sm text-muted-foreground">No expenses this month</p>
                {walletAccounts.length === 0 ? (
                  <a href="/accounts"
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
                    Set up an account first →
                  </a>
                ) : (
                  <button onClick={() => setQuickModal("expense")}
                    className="text-xs text-red-500 dark:text-red-400 hover:underline transition-colors">
                    + Add your first expense
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 6-Month Trend ── */}
        {trend.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground text-sm mb-4">6-Month Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trend} barSize={18} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={chart.gridColor} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chart.axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chart.axisColor, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCurrencyCompact(v)} width={55} />
                <Tooltip
                  contentStyle={chart.tooltipStyle}
                  labelStyle={chart.labelStyle}
                  itemStyle={chart.itemStyle}
                  cursor={chart.cursorStyle}
                  formatter={(v: number, name: string) => [formatCurrency(v), name]}
                />
                <Legend iconType="circle" iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: chart.axisColor }} />
                <Bar dataKey="income"   name="Income"   fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="saved"    name="Saved"    fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Bottom Row ── */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Recent Transactions (deduplicated, with account name) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Recent Transactions</h3>
              <Link href="/expenses" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-500/8 transition-all">
                See all →
              </Link>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm", TXN_BG[t.type])}>
                      {t.type === "INCOME" && INCOME_SOURCE_ICONS[t.label]
                        ? <span>{INCOME_SOURCE_ICONS[t.label]}</span>
                        : <span className={cn("text-xs font-bold", TXN_COLORS[t.type])}>{TXN_SIGNS[t.type]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground/90 truncate">{txnLabel(t.type, t.label, t.description)}</p>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        {formatDate(t.date)}
                        <span className="mx-1 text-muted-foreground/30">·</span>
                        <span className="text-muted-foreground/50">{(t as any).accountName}</span>
                      </p>
                    </div>
                    <p className={cn("text-xs font-semibold tabular-nums shrink-0", TXN_COLORS[t.type])}>
                      {TXN_SIGNS[t.type]}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Goals Summary */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="font-semibold text-foreground text-sm">Goals</h3>
              <Link href="/goals" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-500/8 transition-all">
                See all →
              </Link>
            </div>
            {goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <p className="text-sm text-muted-foreground">No goals set up</p>
                <Link href="/goals" className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                  Create a goal →
                </Link>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center bg-muted/40 rounded-xl p-3">
                    <p className="text-xl font-bold text-foreground">{goals.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                  </div>
                  <div className="text-center bg-emerald-500/8 rounded-xl p-3">
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{completedGoals.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Completed</p>
                  </div>
                  <div className="text-center bg-indigo-500/8 rounded-xl p-3">
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{goalsPct.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Overall</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Total saved across all goals</span>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatCurrency(totalSaved)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${goalsPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-1">of {formatCurrency(totalTarget)} target</p>
                </div>

                <div className="space-y-2.5 pt-1 border-t border-border">
                  {goals.slice(0, 3).map(g => {
                    const pct  = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
                    const done = g.savedAmount >= g.targetAmount;
                    return (
                      <div key={g.id} className="flex items-center gap-2.5">
                        <span className="text-base shrink-0">{g.icon || "🎯"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs text-foreground truncate">{g.name}</p>
                            {done
                              ? <Trophy className="w-3 h-3 text-amber-500 shrink-0 ml-1" />
                              : <span className="text-xs text-muted-foreground shrink-0 ml-1">{pct.toFixed(0)}%</span>}
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-indigo-500")}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Investment Overview ── */}
        {hasInvestments && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">Investment Overview</h3>
              <Link href="/investments" className="text-xs font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-500/8 transition-all">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(() => {
                const gainLoss = data!.totalInvestmentValue - data!.totalInvested;
                const gainPct  = data!.totalInvested > 0 ? (gainLoss / data!.totalInvested) * 100 : 0;
                const isGain   = gainLoss >= 0;
                return [
                  { label: "Invested",       value: data!.totalInvested,         color: "text-foreground",                                  bg: "bg-muted/60",     icon: null,                                                         sub: null },
                  { label: "Current Value",  value: data!.totalInvestmentValue,  color: "text-indigo-600 dark:text-indigo-400",                 bg: "bg-indigo-500/8", icon: null,                                                         sub: null },
                  { label: "Gain / Loss",    value: gainLoss,
                    color: isGain ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    bg:    isGain ? "bg-emerald-500/8" : "bg-red-500/8",
                    icon:  isGain ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />,
                    sub:   `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(2)}%`,
                  },
                  { label: "Investment Income", value: data!.totalDividendIncome, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/8", icon: null, sub: "Dividends · Coupons · FD" },
                ].map(({ label, value, color, bg, icon, sub }) => (
                  <div key={label} className={cn("rounded-xl p-4 border border-border", bg)}>
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <div className={cn("flex items-center gap-1 text-base font-bold tabular-nums", color)}>
                      {icon}{formatCurrency(value)}
                    </div>
                    {sub && <p className="text-xs text-muted-foreground/80 mt-1">{sub}</p>}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
