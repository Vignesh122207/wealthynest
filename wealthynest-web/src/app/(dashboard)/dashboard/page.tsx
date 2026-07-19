"use client";

import {useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {ArrowLeftRight, Banknote, Receipt, Sparkles} from "lucide-react";
import Link from "next/link";
import {type ExpenseFormValues} from "@/features/expenses/schemas/expense.schema";
import {Header} from "@/components/layout/Header";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {type IncomeFormValues, type IncomeSourceValue} from "@/components/transactions/IncomeForm";
import {type TransferFormValues} from "@/components/transactions/TransferFormModal";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {useDashboard} from "@/features/dashboard/hooks/useDashboard";
import {useAccounts, useTransfer} from "@/features/accounts/hooks/useAccounts";
import {useGoals} from "@/features/goals/hooks/useGoals";
import {useCategories} from "@/features/categories/hooks/useCategories";
import {useCreateExpense, useExpenses} from "@/features/expenses/hooks/useExpenses";
import {useCreateIncome, useIncome} from "@/features/income/hooks/useIncome";
import {useInvestments} from "@/features/investments/hooks/useInvestments";
import {useNetWorthHistory} from "@/features/networth/hooks/useNetWorth";
import {useDebts} from "@/features/debts/hooks/useDebts";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useChartTheme} from "@/hooks/useChartTheme";
import {pctChange} from "@/lib/utils";
import {buildUsageCounts, sortByUsage} from "@/lib/mostUsed";
import {toast} from "sonner";

// ── Sub-components ────────────────────────────────────────────────────────────
import {GreetingBanner} from "./_components/GreetingBanner";
import {StatOverview} from "./_components/StatOverview";
import {SmartAlerts} from "./_components/SmartAlerts";
import {NetWorthTrend} from "./_components/NetWorthTrend";
import {WalletOverview} from "./_components/WalletOverview";
import {SpendingDonut} from "./_components/SpendingDonut";
import {BudgetSection} from "./_components/BudgetSection";
import {SixMonthTrend} from "./_components/SixMonthTrend";
import {TransactionList} from "./_components/TransactionList";
import {GoalsSummary} from "./_components/GoalsSummary";
import {InvestmentPanel} from "./_components/InvestmentPanel";
import {DebtPulse} from "./_components/DebtPulse";
import {TwoColRow} from "./_components/TwoColRow";

// Lazy-loaded: the Home dashboard's own bundle shouldn't carry all three quick-add forms just so
// one can appear after a FAB click — each is only fetched the first time its modal actually opens.
const ExpenseForm      = dynamic(() => import("@/components/transactions/ExpenseForm").then(m => m.ExpenseForm), { ssr: false });
const IncomeForm       = dynamic(() => import("@/components/transactions/IncomeForm").then(m => m.IncomeForm), { ssr: false });
const TransferFormModal = dynamic(() => import("@/components/transactions/TransferFormModal").then(m => m.TransferFormModal), { ssr: false });

// ── Quick-add modals ──────────────────────────────────────────────────────────

type QuickModal = "none" | "expense" | "income" | "transfer";

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

  const { data, isLoading, isError, refetch } = useDashboard(year, month);
  const { data: prevData }            = useDashboard(prevYearNum, prevMonthNum);
  const { data: walletAccounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: goals = [] }          = useGoals();
  const { data: categories = [] }       = useCategories("EXPENSE");
  const { data: incomeCategories = [] } = useCategories("INCOME");
  const { data: investments = [] }    = useInvestments();
  const { data: netWorthHistory = [] } = useNetWorthHistory();
  const { data: debts = [] }          = useDebts();
  const chart                         = useChartTheme();

  // Quick-add form data/handlers — same forms as the Transactions page, so behavior
  // (validation, payment-method derivation, Paid Via/category pickers) stays identical
  // no matter where a transaction is added from.
  const cashAccounts   = walletAccounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts   = walletAccounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const creditAccounts = walletAccounts.filter(a => a.accountType === "CREDIT_CARD");

  // Same all-time history the Transactions page fetches, used to seed the "last used / most
  // frequent" category and income-source defaults below, and to sort each picker most-used
  // first — without this, Home's quick-add forms always start with nothing selected and list
  // categories in whatever order the API returns them instead of Groceries/Salary-first.
  const { data: allTimeExpensesData }   = useExpenses({ size: 2000, sortDir: "asc", includeDebt: true });
  const allTimeExpenses = useMemo(() => allTimeExpensesData?.data ?? [], [allTimeExpensesData]);
  const { data: allTimeIncome = [] }    = useIncome(undefined, undefined, true);

  const expenseCategoryUsage = useMemo(() => buildUsageCounts(allTimeExpenses, e => e.categoryId), [allTimeExpenses]);
  const incomeSourceUsage    = useMemo(() => buildUsageCounts(allTimeIncome, i => i.source), [allTimeIncome]);
  const categoryOptions = useMemo(() =>
    sortByUsage(categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color })), o => o.value, expenseCategoryUsage),
    [categories, expenseCategoryUsage]);

  const defaultExpenseCategoryId = useMemo(() => {
    if (allTimeExpenses.length === 0) return undefined;
    const mostRecent = [...allTimeExpenses].sort((a, b) =>
      b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt))[0];
    if (mostRecent?.categoryId) return mostRecent.categoryId;
    const counts = new Map<string, number>();
    allTimeExpenses.forEach(e => { if (e.categoryId) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1); });
    let best: string | undefined, bestCount = 0;
    counts.forEach((count, id) => { if (count > bestCount) { best = id; bestCount = count; } });
    return best;
  }, [allTimeExpenses]);

  const defaultIncomeSource = useMemo((): IncomeSourceValue => {
    if (allTimeIncome.length === 0) return "SALARY";
    const mostRecent = [...allTimeIncome].sort((a, b) =>
      b.incomeDate.localeCompare(a.incomeDate) || b.createdAt.localeCompare(a.createdAt))[0];
    if (mostRecent?.source) return mostRecent.source as IncomeSourceValue;
    const counts = new Map<string, number>();
    allTimeIncome.forEach(i => counts.set(i.source, (counts.get(i.source) ?? 0) + 1));
    let best: string | undefined, bestCount = 0;
    counts.forEach((count, source) => { if (count > bestCount) { best = source; bestCount = count; } });
    return (best as IncomeSourceValue) ?? "SALARY";
  }, [allTimeIncome]);

  const { mutate: createExpense, isPending: creatingExpense } = useCreateExpense();
  const { mutate: createIncome,  isPending: creatingIncome }  = useCreateIncome();
  const { mutate: createTransfer, isPending: creatingTransfer } = useTransfer();

  const handleCreateExpense = (values: ExpenseFormValues) => {
    const accountId = values.accountId;
    const accountType = walletAccounts.find(a => a.id === accountId)?.accountType;
    const paymentMethod = accountType === "CASH_WALLET" ? "CASH"
      : accountType === "CREDIT_CARD" ? "CREDIT_CARD" : accountType ? "BANK_ACCOUNT" : undefined;
    createExpense(
      { ...values, amount: Number(values.amount), accountId, paymentMethod },
      { onSuccess: () => { toast.success("Expense added"); setQuickModal("none"); } }
    );
  };

  const handleAddIncome = (values: IncomeFormValues) => {
    const d = new Date(values.incomeDate);
    createIncome(
      {
        source: values.source, amount: values.amount, incomeDate: values.incomeDate,
        periodMonth: d.getMonth() + 1, periodYear: d.getFullYear(),
        accountId: values.accountId || undefined, description: values.description || undefined,
        paymentMode: (() => {
          if (!values.accountId) return "CASH";
          const acc = walletAccounts.find(a => a.id === values.accountId);
          return acc?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT";
        })(),
      },
      { onSuccess: () => { toast.success("Income recorded"); setQuickModal("none"); } }
    );
  };

  const handleAddTransfer = (values: TransferFormValues) => {
    createTransfer(
      { fromAccountId: values.fromAccountId, toAccountId: values.toAccountId,
        amount: Number(values.amount), transferDate: values.transferDate,
        description: values.description || undefined },
      { onSuccess: () => { toast.success("Transfer complete"); setQuickModal("none"); } }
    );
  };

  const todayStr = now.toISOString().split("T")[0];
  const next7    = new Date(now); next7.setDate(now.getDate() + 7);
  const next7Str = next7.toISOString().split("T")[0];
  const { data: recurringPage } = useExpenses({ recurring: true, startDate: todayStr, endDate: next7Str, size: 10 });
  const upcomingBills = recurringPage?.data ?? [];


  const recentTransactions = useMemo(() => {
    const seen = new Set<string>();
    return walletAccounts
      .flatMap(a => a.recentTransactions.map(t => ({ ...t, accountName: a.name })))
      .filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);
  }, [walletAccounts]);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const trend          = data?.monthlyTrend ?? [];
  const hasInvestments = investments.some(i => i.active);
  const incomeTrend    = pctChange(data?.monthlyIncome, prevData?.monthlyIncome);
  const expenseTrend   = pctChange(data?.monthlyExpenses, prevData?.monthlyExpenses);
  // Not derived from the dashboard endpoint's totalNetWorth: that field ignores
  // year/month entirely and always returns today's live net worth, so comparing
  // "this month" vs "last month" via that field just compares the same number to
  // itself. Real monthly snapshots (same data backing the trend chart) give an
  // actual month-over-month comparison instead.
  const latestSnapshot = netWorthHistory[netWorthHistory.length - 1];
  const prevSnapshot   = netWorthHistory[netWorthHistory.length - 2];
  const netWorthTrend  = pctChange(latestSnapshot?.netWorth, prevSnapshot?.netWorth);
  const firstName      = user?.fullName?.split(" ")[0] ?? "there";

  const budgetSummaries = data?.budgetSummaries ?? [];
  const overBudgetCount = budgetSummaries.filter(b => b.overBudget).length;

  const smartInsights = useMemo(() => {
    if (!data?.categoryBreakdown?.length || !prevData?.categoryBreakdown?.length) return [];
    const prevMap = new Map(prevData.categoryBreakdown.map((c) => [c.categoryId, c.amount ?? 0]));
    const avgMonthlySpend = data.monthlyExpenses > 0 ? data.monthlyExpenses : 5000;
    const threshold = Math.max(100, avgMonthlySpend * 0.05);
    const deltas: { category: string; delta: number }[] = [];
    for (const c of data.categoryBreakdown) {
      const prev = prevMap.get(c.categoryId) ?? 0;
      const delta = (c.amount ?? 0) - prev;
      if (Math.abs(delta) >= threshold) deltas.push({ category: c.categoryName, delta });
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return deltas.slice(0, 3);
  }, [data, prevData]);

  return (
    <div className="flex flex-col flex-1 bg-background">
      <Header title="Home" subtitle="Your complete financial picture at a glance" />

      {/* Quick-add modals — same ExpenseForm/IncomeForm/TransferFormModal used on the
          Transactions page, so Home's "Add Expense/Income/Transfer" behaves identically. */}
      {quickModal === "expense" && (
        <TransactionModalOverlay onDismiss={() => setQuickModal("none")}>
          <ExpenseForm title="New Expense" defaultCategoryId={defaultExpenseCategoryId} categoryOptions={categoryOptions}
            cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={creditAccounts}
            onSubmit={handleCreateExpense} onCancel={() => setQuickModal("none")}
            isPending={creatingExpense} submitLabel="Add Expense" />
        </TransactionModalOverlay>
      )}
      {quickModal === "income" && (
        <TransactionModalOverlay onDismiss={() => setQuickModal("none")}>
          <IncomeForm onSubmit={handleAddIncome} onCancel={() => setQuickModal("none")}
            defaultSource={defaultIncomeSource} sourceUsageCounts={incomeSourceUsage}
            isPending={creatingIncome} accounts={walletAccounts} incomeCategories={incomeCategories} />
        </TransactionModalOverlay>
      )}
      {quickModal === "transfer" && (
        <TransactionModalOverlay onDismiss={() => setQuickModal("none")}>
          <TransferFormModal onSubmit={handleAddTransfer} onCancel={() => setQuickModal("none")}
            isPending={creatingTransfer} accounts={walletAccounts} />
        </TransactionModalOverlay>
      )}

      <main className="flex-1 overflow-auto pb-36 lg:pb-24">
        <div className="max-w-7xl mx-auto p-4 md:p-5 lg:p-6 space-y-4 lg:space-y-5">

          {/* ── Onboarding: new user ── */}
          {!isLoading && !accountsLoading && walletAccounts.length === 0 && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6 space-y-4 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <PremiumIcon icon={Sparkles} tone="purple" size="md" className="w-10 h-10" />
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
            savingsRate={data?.savingsRate}
          />

          {/* ── Core dashboard data failed — the widgets below would otherwise render a silent
              zero-state indistinguishable from a genuinely new account, so this stands in for
              them specifically rather than for the whole page (Accounts/Goals/Investments below
              come from their own independent queries and can still succeed on their own). ── */}
          {isError && (
            <QueryErrorState onRetry={() => refetch()} className="py-8 bg-card border border-border rounded-2xl"
              description="Couldn't load your monthly totals, budgets, or spending trend. Check your connection and try again." />
          )}

          {/* ── Stat Overview: Net Worth, Investments, Income, Expenses, Savings Rate, Budget Progress ── */}
          <StatOverview
            netWorth={data?.totalNetWorth}
            prevNetWorth={prevData?.totalNetWorth}
            netWorthHistory={netWorthHistory}
            investments={investments}
            income={data?.monthlyIncome}
            expenses={data?.monthlyExpenses}
            savingsRate={data?.savingsRate}
            prevSavingsRate={prevData?.savingsRate}
            incomeTrend={incomeTrend}
            expenseTrend={expenseTrend}
            budgetSummaries={budgetSummaries}
            alertBannerVisible={!overBudgetDismissed && overBudgetCount > 0}
            isLoading={isLoading}
          />

          {/* ── Alerts: over-budget + smart insights + upcoming bills ── */}
          <SmartAlerts
            smartInsights={smartInsights}
            upcomingBills={upcomingBills}
            overBudgetCount={overBudgetCount}
            overBudgetDismissed={overBudgetDismissed}
            onDismissOverBudget={() => {
              setOverBudgetDismissed(true);
              localStorage.setItem(`overBudgetDismissed_${year}_${month}`, "true");
            }}
          />

          {/* ── Debts: lending/borrowing pulse — only renders when there's an active debt ── */}
          <DebtPulse debts={debts} />

          {/* ── Phase 1: Accounts Overview (left) + Spending chart (right) ── */}
          {walletAccounts.length > 0 && (
            <TwoColRow>
              <WalletOverview accounts={walletAccounts} />
              <SpendingDonut
                categoryBreakdown={data?.categoryBreakdown ?? []}
                year={year}
                month={month}
                chart={chart}
                onAddExpense={() => setQuickModal("expense")}
                isLoading={isLoading}
              />
            </TwoColRow>
          )}

          {/* ── Phase 2: Budget Progress (left) + Recent Transactions (right) ── */}
          <TwoColRow>
            <BudgetSection
              budgetSummaries={data?.budgetSummaries ?? []}
              year={year}
              month={month}
              isLoading={isLoading}
            />
            <TransactionList transactions={recentTransactions} isLoading={isLoading} />
          </TwoColRow>

          {/* ── Phase 3: Net Worth Trend (left) + 6-Month Income/Expense/Savings Trend (right) ── */}
          <TwoColRow>
            <NetWorthTrend
              history={netWorthHistory}
              netWorth={data?.totalNetWorth}
              changePct={netWorthTrend}
              chart={chart}
              isLoading={isLoading}
            />
            <SixMonthTrend trend={trend} chart={chart} isLoading={isLoading} />
          </TwoColRow>

          {/* ── Investment Overview (left) + Goals (right) ── */}
          {hasInvestments ? (
            <TwoColRow>
              <InvestmentPanel investments={investments} chart={chart} />
              <GoalsSummary goals={goals} isLoading={isLoading} />
            </TwoColRow>
          ) : (
            <GoalsSummary goals={goals} isLoading={isLoading} />
          )}

        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Receipt,        label: "Add Expense", color: "rose",    onClick: () => setQuickModal("expense"),  disabled: walletAccounts.length === 0,
          disabledReason: "Add an account first" },
        { icon: Banknote,       label: "Add Income",  color: "emerald", onClick: () => setQuickModal("income"),   disabled: walletAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0,
          disabledReason: "Add a bank or cash account first" },
        { icon: ArrowLeftRight, label: "Transfer",    color: "indigo",  onClick: () => setQuickModal("transfer"), disabled: walletAccounts.length < 2,
          disabledReason: "Add at least 2 accounts first" },
      ]} />
    </div>
  );
}
