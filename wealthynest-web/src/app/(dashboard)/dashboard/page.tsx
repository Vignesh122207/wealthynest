"use client";

import { useState, useMemo } from "react";
import {
  Wallet, Receipt, Banknote, Sparkles, ArrowUpRight, ArrowDownRight,
  X, ArrowLeftRight, Building2, CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { Header }                from "@/components/layout/Header";
import { FloatingActionButton }  from "@/components/shared/FloatingActionButton";
import { FormCurrencyInput }     from "@/components/forms/FormCurrencyInput";
import { FormSelect }            from "@/components/forms/FormSelect";
import { FormDatePicker }        from "@/components/forms/FormDatePicker";
import { FormInput }             from "@/components/forms/FormInput";
import { useDashboard }          from "@/features/dashboard/hooks/useDashboard";
import { useAccounts }           from "@/features/accounts/hooks/useAccounts";
import { useGoals }              from "@/features/goals/hooks/useGoals";
import { useCategories }         from "@/features/categories/hooks/useCategories";
import { useCreateExpense, useExpenses } from "@/features/expenses/hooks/useExpenses";
import { useCreateIncome }       from "@/features/income/hooks/useIncome";
import { useTransfer }           from "@/features/accounts/hooks/useAccounts";
import { useAuthStore }          from "@/features/auth/store/auth.store";
import { useChartTheme }         from "@/hooks/useChartTheme";
import { formatCurrencyCompact, formatCurrency, cn } from "@/lib/utils";
import { INCOME_SOURCES }        from "@/lib/constants";
import { toast }                 from "sonner";

// ── Sub-components ────────────────────────────────────────────────────────────
import { GreetingBanner }   from "./_components/GreetingBanner";
import { InsightRow }       from "./_components/InsightRow";
import { SummaryCards }     from "./_components/SummaryCards";
import { SmartAlerts }      from "./_components/SmartAlerts";
import { WalletOverview }   from "./_components/WalletOverview";
import { BudgetSection }    from "./_components/BudgetSection";
import { ChartsGrid }       from "./_components/ChartsGrid";
import { TransactionList }  from "./_components/TransactionList";
import { GoalsSummary }     from "./_components/GoalsSummary";
import { InvestmentPanel }  from "./_components/InvestmentPanel";

// ── Quick-add modals ──────────────────────────────────────────────────────────

type QuickModal = "none" | "expense" | "income" | "transfer";

function QuickModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
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
    accountId: "", categoryId: "", amount: 0, description: "",
    expenseDate: now.toISOString().split("T")[0],
  }});

  const channelList    = payChannel === "CASH" ? cashAccounts : payChannel === "ACCOUNT" ? bankAccounts : payChannel === "CREDIT" ? creditAccounts : [];
  const accountOptions = channelList.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));

  const handleChannel = (ch: "CASH" | "ACCOUNT" | "CREDIT") => {
    setPayChannel(ch);
    form.setValue("accountId", "");
    const list = ch === "CASH" ? cashAccounts : ch === "ACCOUNT" ? bankAccounts : creditAccounts;
    if (list.length === 1) form.setValue("accountId", list[0].id);
  };

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
      {accounts.length === 0 ? (
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
            error={form.formState.errors.categoryId?.message}
            {...form.register("categoryId", { required: "Select a category" })} />
          <FormCurrencyInput label="Amount" placeholder="0"
            error={form.formState.errors.amount?.message}
            {...form.register("amount", { required: true, min: 0.01 })} />
          <Controller control={form.control} name="expenseDate" render={({ field }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )} />
          <FormInput label="Description (optional)" placeholder="e.g. Grocery shopping" {...form.register("description")} />
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
            <button type="button" onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
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
    accountId: "", source: "SALARY", amount: 0, description: "",
    incomeDate: now.toISOString().split("T")[0],
  }});

  const nonCreditAccounts = accounts.filter(a => a.accountType !== "CREDIT_CARD");
  const accountOptions    = nonCreditAccounts.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));

  const onSubmit = (v: any) => {
    const account = accounts.find(a => a.id === v.accountId);
    const d = new Date(v.incomeDate);
    createIncome({
      accountId: v.accountId || undefined, source: v.source as any,
      paymentMode: account?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT",
      amount: Number(v.amount), description: v.description || undefined,
      incomeDate: v.incomeDate, periodMonth: d.getMonth() + 1, periodYear: d.getFullYear(),
    }, { onSuccess: () => { toast.success("Income recorded"); onClose(); } });
  };

  return (
    <QuickModalShell title="Quick Add Income" onClose={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormSelect label="Credit To" options={accountOptions} placeholder="Select account"
          error={form.formState.errors.accountId?.message}
          {...form.register("accountId", { required: "Select an account" })} />
        <FormSelect label="Source" options={INCOME_SOURCES} placeholder="Select source"
          error={form.formState.errors.source?.message}
          {...form.register("source", { required: "Select a source" })} />
        <FormCurrencyInput label="Amount" placeholder="0"
          error={form.formState.errors.amount?.message}
          {...form.register("amount", { required: true, min: 0.01 })} />
        <Controller control={form.control} name="incomeDate" render={({ field }) => (
          <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
        )} />
        <FormInput label="Description (optional)" placeholder="e.g. June salary" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60">
            {isPending ? "Saving…" : "Add Income"}
          </button>
          <button type="button" onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
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
    fromAccountId: "", toAccountId: "", amount: 0, description: "",
    transferDate: now.toISOString().split("T")[0],
  }});

  const allOptions    = accounts.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const creditOptions = accounts.filter(a => a.accountType === "CREDIT_CARD").map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)} due` }));
  const fromOptions   = accounts.filter(a => a.accountType !== "CREDIT_CARD").map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
  const toOptions     = [...allOptions.filter(o => accounts.find(a => a.id === o.value)?.accountType !== "CREDIT_CARD"), ...creditOptions];

  const onSubmit = (v: any) => {
    if (v.fromAccountId === v.toAccountId) {
      form.setError("toAccountId", { message: "Cannot transfer to same account" });
      return;
    }
    doTransfer({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId,
      amount: Number(v.amount), description: v.description || undefined, transferDate: v.transferDate },
      { onSuccess: () => { toast.success("Transfer complete"); onClose(); } });
  };

  return (
    <QuickModalShell title="Quick Transfer" onClose={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormSelect label="From" options={fromOptions} placeholder="Source account"
          error={form.formState.errors.fromAccountId?.message}
          {...form.register("fromAccountId", { required: "Select source" })} />
        <FormSelect label="To" options={toOptions} placeholder="Destination account"
          error={(form.formState.errors.toAccountId as any)?.message}
          {...form.register("toAccountId", { required: "Select destination" })} />
        <FormCurrencyInput label="Amount" placeholder="0"
          error={form.formState.errors.amount?.message}
          {...form.register("amount", { required: true, min: 0.01 })} />
        <Controller control={form.control} name="transferDate" render={({ field }) => (
          <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
        )} />
        <FormInput label="Note (optional)" placeholder="e.g. Bill payment" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
            {isPending ? "Processing…" : "Transfer"}
          </button>
          <button type="button" onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </QuickModalShell>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user }    = useAuthStore();
  const now         = new Date();
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

  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYearNum  = month === 1 ? year - 1 : year;

  const { data, isLoading }           = useDashboard(year, month);
  const { data: prevData }            = useDashboard(prevYearNum, prevMonthNum);
  const { data: walletAccounts = [] } = useAccounts();
  const { data: goals = [] }          = useGoals();
  const { data: categories = [] }     = useCategories("EXPENSE");
  const chart                         = useChartTheme();

  const todayStr = now.toISOString().split("T")[0];
  const next7    = new Date(now); next7.setDate(now.getDate() + 7);
  const next7Str = next7.toISOString().split("T")[0];
  const { data: recurringPage } = useExpenses({ recurring: true, startDate: todayStr, endDate: next7Str, size: 10 });
  const upcomingBills = recurringPage?.data ?? [];

  const cashBalance         = walletAccounts.filter(a => a.accountType === "CASH_WALLET")  .reduce((s, a) => s + a.currentBalance, 0);
  const bankBalance         = walletAccounts.filter(a => a.accountType === "BANK_ACCOUNT") .reduce((s, a) => s + a.currentBalance, 0);
  const creditCardDebt      = walletAccounts.filter(a => a.accountType === "CREDIT_CARD")  .reduce((s, a) => s + Math.max(0, a.currentBalance), 0);
  const totalAccountBalance = cashBalance + bankBalance;

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
  }, [walletAccounts, todayStr]);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const trend          = data?.monthlyTrend ?? [];
  const hasInvestments = data && (data.totalInvested > 0 || data.totalInvestmentValue > 0);
  const netCashFlow    = data ? data.monthlyIncome - data.monthlyExpenses : 0;
  const incomeTrend    = prevData && prevData.monthlyIncome  > 0 ? ((data?.monthlyIncome  ?? 0) - prevData.monthlyIncome)  / prevData.monthlyIncome  * 100 : undefined;
  const expenseTrend   = prevData && prevData.monthlyExpenses > 0 ? ((data?.monthlyExpenses ?? 0) - prevData.monthlyExpenses) / prevData.monthlyExpenses * 100 : undefined;
  const firstName      = user?.fullName?.split(" ")[0] ?? "there";

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

      <main className="flex-1 overflow-auto pb-36 lg:pb-24">
        <div className="max-w-7xl mx-auto p-4 md:p-5 lg:p-6 space-y-4 lg:space-y-5">

          {/* ── Onboarding: new user ── */}
          {!isLoading && walletAccounts.length === 0 && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 space-y-4 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Welcome to WealthyNest!</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Get started in 3 simple steps to track your finances.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { step: 1, href: "/accounts", title: "Add an Account", sub: "Bank, cash, or credit card" },
                  { step: 2, href: "/expenses",  title: "Log Expenses",  sub: "Track where your money goes" },
                  { step: 3, href: "/budgets",   title: "Set a Budget",  sub: "Stay on top of your limits" },
                ].map(({ step, href, title, sub }) => (
                  <Link key={step} href={href}
                    className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Greeting Banner ── */}
          <GreetingBanner
            firstName={firstName}
            year={year}
            month={month}
            isCurrentMonth={isCurrentMonth}
            onNavigate={navigate}
            netWorth={data?.totalNetWorth}
            prevNetWorth={prevData?.totalNetWorth}
            savingsRate={data?.savingsRate}
            netCashFlow={netCashFlow}
            isLoading={isLoading}
          />

          {/* ── Insight Row ── */}
          <InsightRow
            savingsRate={data?.savingsRate}
            netCashFlow={netCashFlow}
            totalAccountBalance={totalAccountBalance}
            budgetSummaries={data?.budgetSummaries ?? []}
            monthlyIncome={data?.monthlyIncome}
            year={year}
            month={month}
            isLoading={isLoading}
          />

          {/* ── Summary Cards ── */}
          <SummaryCards
            year={year}
            month={month}
            income={data?.monthlyIncome}
            expenses={data?.monthlyExpenses}
            savingsRate={data?.savingsRate}
            todaySpending={todaySpending}
            incomeTrend={incomeTrend}
            expenseTrend={expenseTrend}
            trend={trend}
            isLoading={isLoading}
          />

          {/* ── Alerts: over-budget + smart insights + upcoming bills ── */}
          <SmartAlerts
            smartInsights={smartInsights}
            upcomingBills={upcomingBills}
            overBudgetCount={data?.budgetSummaries?.filter(b => b.overBudget).length ?? 0}
            overBudgetDismissed={overBudgetDismissed}
            onDismissOverBudget={() => {
              setOverBudgetDismissed(true);
              localStorage.setItem(`overBudgetDismissed_${year}_${month}`, "true");
            }}
            year={year}
            month={month}
          />

          {/* ── Wallet Overview ── */}
          {walletAccounts.length > 0 && (
            <WalletOverview
              totalAccountBalance={totalAccountBalance}
              bankBalance={bankBalance}
              cashBalance={cashBalance}
              creditCardDebt={creditCardDebt}
            />
          )}

          {/* ── Charts: 6-month trend + spending donut ── */}
          <ChartsGrid
            trend={trend}
            categoryBreakdown={data?.categoryBreakdown ?? []}
            year={year}
            month={month}
            chart={chart}
            onAddExpense={() => setQuickModal("expense")}
            isLoading={isLoading}
          />

          {/* ── Budget Section ── */}
          <div className="grid lg:grid-cols-2 gap-4 items-stretch">
            <BudgetSection
              budgetSummaries={data?.budgetSummaries ?? []}
              year={year}
              month={month}
              isLoading={isLoading}
            />

            {/* ── Recent Transactions ── */}
            <TransactionList transactions={recentTransactions} isLoading={isLoading} />
          </div>

          {/* ── Goals Summary ── */}
          <GoalsSummary goals={goals} isLoading={isLoading} />

          {/* ── Investment Overview ── */}
          {hasInvestments && data && (
            <InvestmentPanel
              totalInvested={data.totalInvested}
              totalInvestmentValue={data.totalInvestmentValue}
              totalDividendIncome={data.totalDividendIncome}
            />
          )}

        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Receipt,        label: "Add Expense", color: "rose",    onClick: () => setQuickModal("expense"),  disabled: walletAccounts.length === 0 },
        { icon: Banknote,       label: "Add Income",  color: "emerald", onClick: () => setQuickModal("income"),   disabled: walletAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0 },
        { icon: ArrowLeftRight, label: "Transfer",    color: "indigo",  onClick: () => setQuickModal("transfer"), disabled: walletAccounts.length < 2 },
      ]} />
    </div>
  );
}
