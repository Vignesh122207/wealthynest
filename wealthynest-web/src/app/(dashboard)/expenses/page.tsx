"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus, Receipt, ChevronLeft, ChevronRight,
  Banknote, CreditCard, RefreshCw, Wallet,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, HandCoins,
} from "lucide-react";
import { getCategoryIcon, getCategoryColor, INCOME_ICON_MAP } from "@/lib/categoryMeta";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ExpenseForm } from "@/components/transactions/ExpenseForm";
import { IncomeForm, type IncomeFormValues, type IncomeSourceValue } from "@/components/transactions/IncomeForm";
import { TransferFormModal, type TransferFormValues } from "@/components/transactions/TransferFormModal";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import {
  useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense,
} from "@/features/expenses/hooks/useExpenses";
import { useCategories } from "@/features/categories/hooks/useCategories";
import {
  useAccounts, useTransfers, useTransfer, useUpdateTransfer, useDeleteTransfer,
} from "@/features/accounts/hooks/useAccounts";
import {
  useIncome, useCreateIncome, useUpdateIncome, useDeleteIncome,
} from "@/features/income/hooks/useIncome";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useFamilyMembers } from "@/features/family/hooks/useFamily";
import { type ExpenseFormValues } from "@/features/expenses/schemas/expense.schema";
import type { SplitParticipant } from "@/features/expenses/types/expense.types";
import { exportCsv, exportIncomeCsv, exportTransfersCsv, exportAllCsv } from "@/features/expenses/utils/csvExport";
import { pad } from "@/features/expenses/utils/filterHelpers";
import { ExpenseRow, IncomeRow, TransferRow, DebtBadge } from "@/features/expenses/components/TransactionRows";
import { Chip } from "@/features/expenses/components/Chip";
import { TypeTabs } from "@/features/expenses/components/TypeTabs";
import { DateControls } from "@/features/expenses/components/DateControls";
import { StatCards } from "@/features/expenses/components/StatCards";
import { Toolbar } from "@/features/expenses/components/Toolbar";
import { ImportStatementModal } from "@/features/statementimport/components/ImportStatementModal";
import { FilterPanel } from "@/features/expenses/components/FilterPanel";
import type { TxType, DateMode, SortKey, Channel } from "@/features/expenses/types/filters.types";
import { formatDate, cn, pctChange } from "@/lib/utils";
import { buildUsageCounts, sortByUsage, pickSmartDefault } from "@/lib/mostUsed";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";
import { useDebounce } from "@/hooks/useDebounce";
import { INCOME_SOURCES } from "@/lib/constants";
import type { Category } from "@/features/categories/types/category.types";
import type { Expense } from "@/features/expenses/types/expense.types";
import type { IncomeEntry } from "@/features/income/types/income.types";
import type { AccountTransfer } from "@/features/accounts/types/account.types";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { fmt } = useAmountFormatter();
  const now = new Date();
  const searchParams = useSearchParams();

  // Type tab
  const [txType, setTxType] = useState<TxType>("all");

  // Shared date state
  const [dateMode,    setDateMode]    = useState<DateMode>("month");
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");

  // Expense-specific state
  const [payChannel,       setPayChannel]       = useState<Channel>("");
  const [categoryId,       setCategoryId]       = useState("");
  const [minAmount,        setMinAmount]        = useState<number | "">("");
  const [maxAmount,        setMaxAmount]        = useState<number | "">("");
  const [sortKey,          setSortKey]          = useState<SortKey>("date-desc");
  const [recurringOnly,    setRecurringOnly]    = useState(false);
  const [showCreate,       setShowCreate]       = useState(false);
  const [editExpense,      setEditExpense]      = useState<Expense | null>(null);
  const [confirmId,        setConfirmId]        = useState<string | null>(null);
  const [listPage,         setListPage]         = useState(0);

  // Shared toolbar — search, filters drawer
  const [search,           setSearch]           = useState("");
  const [showFilterPanel,  setShowFilterPanel]  = useState(false);

  // Income state
  const [showAddIncome,   setShowAddIncome]   = useState(false);
  const [editIncome,      setEditIncome]      = useState<IncomeEntry | null>(null);
  const [confirmIncomeId, setConfirmIncomeId] = useState<string | null>(null);
  const [incomeSort,      setIncomeSort]      = useState<"newest"|"oldest"|"high"|"low">("newest");

  // Transfer state
  const [showAddTransfer,   setShowAddTransfer]   = useState(false);
  const [editTransfer,      setEditTransfer]      = useState<AccountTransfer | null>(null);
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);
  const [showImportStatement, setShowImportStatement] = useState(false);
  const [transferSort,      setTransferSort]      = useState<"newest"|"oldest"|"high"|"low">("newest");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // All-tab pagination
  const [allPage, setAllPage] = useState(0);
  const ALL_PAGE_SIZE = 20;

  const debouncedSearch = useDebounce(search, 400);
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";

  const { data: categories = [] }       = useCategories("EXPENSE");
  const { data: incomeCategories = [] } = useCategories("INCOME");
  const { data: allAccounts = [] }      = useAccounts();

  const cashAccounts   = allAccounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts   = allAccounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const creditAccounts = allAccounts.filter(a => a.accountType === "CREDIT_CARD");
  const accountMap     = useMemo(() => Object.fromEntries(allAccounts.map(a => [a.id, a.name])),        [allAccounts]);
  const accountTypeMap = useMemo(() => Object.fromEntries(allAccounts.map(a => [a.id, a.accountType])), [allAccounts]);

  // Derived date range
  const { startDate, endDate } = useMemo(() => {
    if (dateMode === "month") return {
      startDate: `${year}-${pad(month)}-01`,
      endDate:   new Date(year, month, 0).toISOString().split("T")[0],
    };
    if (dateMode === "year") return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    if (dateMode === "custom") {
      if (customStart && customEnd && customEnd < customStart) return { startDate: undefined, endDate: undefined };
      return { startDate: customStart || undefined, endDate: customEnd || undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateMode, year, month, customStart, customEnd]);

  // ─── Expense data ──────────────────────────────────────────────────────────
  const accountIds = useMemo(() => {
    if (payChannel === "CASH")    return cashAccounts.map(a => a.id);
    if (payChannel === "ACCOUNT") return bankAccounts.map(a => a.id);
    if (payChannel === "CREDIT")  return creditAccounts.map(a => a.id);
    return [];
  }, [payChannel, cashAccounts, bankAccounts, creditAccounts]);

  const [sortBy, sortDir] = sortKey.split("-") as ["expenseDate" | "amount", "asc" | "desc"];
  const PAGE_SIZE = 25;

  // An explicit account selection (from the "view transactions for this account" entry point,
  // or the filter panel's account picker) takes priority over the payment-channel-derived list.
  const effectiveAccountIds = selectedAccountIds.length > 0 ? selectedAccountIds : accountIds;

  const expenseFilters = {
    startDate:  recurringOnly ? undefined : startDate as string | undefined,
    endDate:    recurringOnly ? undefined : endDate as string | undefined,
    search:     debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    accountIds: effectiveAccountIds.length ? effectiveAccountIds : undefined,
    minAmount:  minAmount !== "" ? Number(minAmount) : undefined,
    maxAmount:  maxAmount !== "" ? Number(maxAmount) : undefined,
    recurring:  recurringOnly ? true : undefined,
    sortBy, sortDir,
    page: listPage,
    size: PAGE_SIZE,
  };

  const { data: expenseData, isLoading: expensesLoading } = useExpenses(expenseFilters);

  // Previous month, used by the stat-card deltas below (dashboardSummary vs prevDashboardSummary)
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYearNum  = month === 1 ? year - 1 : year;

  // ─── Income data ───────────────────────────────────────────────────────────
  const incomeYear  = dateMode === "all" ? undefined : year;
  const incomeMonth = dateMode === "month" ? month : undefined;
  const { data: incomeData = [], isLoading: incomeLoading } = useIncome(incomeYear, incomeMonth);
  const { data: allIncomeRaw = [] } = useIncome(incomeYear, incomeMonth, true);

  // ─── Transfer data ─────────────────────────────────────────────────────────
  const { data: transfersPage, isLoading: transfersLoading } = useTransfers(0, 500);
  const allTransfers = useMemo(() => transfersPage?.data ?? [], [transfersPage]);

  // ─── All-time data, unscoped by the selected date range ────────────────────
  // Powers two things that a date-scoped fetch can't answer correctly: the running
  // balance column (needs full history per account, anchored at opening balance) and,
  // outside "month" mode, the stat-card totals (the month-mode dashboard aggregate below
  // is server-summed with no size cap; this is the fallback for year/custom/all ranges).
  const { data: allTimeExpensesData } = useExpenses({ size: 2000, sortDir: "asc", includeDebt: true });
  const allTimeExpenses = useMemo(() => allTimeExpensesData?.data ?? [], [allTimeExpensesData]);
  const { data: allTimeIncome = [] } = useIncome(undefined, undefined, true);
  const { data: dashboardSummary }     = useDashboard(year, month);
  const { data: prevDashboardSummary } = useDashboard(prevYearNum, prevMonthNum);

  // Filter transfers by date range client-side
  const filteredTransfers = useMemo(() => {
    if (dateMode === "all") return allTransfers;
    return allTransfers.filter(t => {
      if (dateMode === "month")  return t.transferDate.startsWith(`${year}-${pad(month)}`);
      if (dateMode === "year")   return t.transferDate.startsWith(`${year}`);
      if (dateMode === "custom") {
        const d = t.transferDate;
        if (startDate && d < startDate) return false;
        if (endDate   && d > endDate)   return false;
        return true;
      }
      return true;
    });
  }, [allTransfers, dateMode, year, month, startDate, endDate]);

  // Filter income by date range (when dateMode = custom/year, we already filter server-side by year but need client-side custom)
  const filteredIncome = useMemo(() => {
    if (dateMode === "custom" && startDate && endDate) {
      return incomeData.filter(i => i.incomeDate >= startDate && i.incomeDate <= endDate);
    }
    return incomeData;
  }, [incomeData, dateMode, startDate, endDate]);

  // Income search — shared search box drives every tab
  const searchedIncome = useMemo(() => {
    if (!debouncedSearch) return filteredIncome;
    const q = debouncedSearch.toLowerCase();
    return filteredIncome.filter(i =>
      (i.description ?? "").toLowerCase().includes(q) ||
      (INCOME_SOURCES.find(s => s.value === i.source)?.label ?? "").toLowerCase().includes(q)
    );
  }, [filteredIncome, debouncedSearch]);

  // Transfer search — shared search box drives every tab
  const searchedTransfers = useMemo(() => {
    let base = filteredTransfers;
    if (selectedAccountIds.length > 0) {
      base = base.filter(t =>
        selectedAccountIds.includes(t.fromAccountId) ||
        selectedAccountIds.includes(t.toAccountId)
      );
    }
    if (!debouncedSearch) return base;
    const q = debouncedSearch.toLowerCase();
    return base.filter(t =>
      (t.description ?? "").toLowerCase().includes(q) ||
      t.fromAccountName.toLowerCase().includes(q) ||
      t.toAccountName.toLowerCase().includes(q)
    );
  }, [filteredTransfers, debouncedSearch, selectedAccountIds]);

  // ─── "All" merged rows ─────────────────────────────────────────────────────
  type TxRow =
    | { kind: "expense";  date: string; data: Expense }
    | { kind: "income";   date: string; data: IncomeEntry }
    | { kind: "transfer"; date: string; data: AccountTransfer };

  const { data: allExpensesRaw } = useExpenses({
    startDate: startDate as string | undefined,
    endDate:   endDate as string | undefined,
    page: 0, size: 300, sortDir: "desc", includeDebt: true,
  });

  const filteredAllIncome = useMemo(() => {
    if (dateMode === "custom" && startDate && endDate) {
      return allIncomeRaw.filter(i => i.incomeDate >= startDate && i.incomeDate <= endDate);
    }
    return allIncomeRaw;
  }, [allIncomeRaw, dateMode, startDate, endDate]);

  // Computed regardless of active tab — the stat cards need these totals everywhere, not just on "All".
  const mergedRows = useMemo<TxRow[]>(() => {
    const rows: TxRow[] = [
      ...(allExpensesRaw?.data ?? []).map(e => ({ kind: "expense" as const, date: e.expenseDate, data: e })),
      ...filteredAllIncome.map(i => ({ kind: "income" as const, date: i.incomeDate, data: i })),
      ...filteredTransfers.map(t => ({ kind: "transfer" as const, date: t.transferDate, data: t })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.data.createdAt.localeCompare(a.data.createdAt));
  }, [allExpensesRaw, filteredAllIncome, filteredTransfers]);

  const txTypeCounts = useMemo<Record<TxType, number>>(() => ({
    all:       mergedRows.length,
    expenses:  mergedRows.filter(r => r.kind === "expense").length,
    income:    mergedRows.filter(r => r.kind === "income").length,
    transfers: mergedRows.filter(r => r.kind === "transfer").length,
  }), [mergedRows]);

  const filteredMergedRows = useMemo(() => {
    return mergedRows.filter(row => {
      // Account filter applies uniformly across all three kinds — e.g. the "view transactions
      // for this account" entry point from an AccountCard, which lands here via ?accountId=.
      if (selectedAccountIds.length > 0) {
        if (row.kind === "expense") {
          const e = row.data as Expense;
          if (!e.accountId || !selectedAccountIds.includes(e.accountId)) return false;
        } else if (row.kind === "income") {
          const inc = row.data as IncomeEntry;
          if (!inc.accountId || !selectedAccountIds.includes(inc.accountId)) return false;
        } else {
          const t = row.data as AccountTransfer;
          if (!selectedAccountIds.includes(t.fromAccountId) && !selectedAccountIds.includes(t.toAccountId)) return false;
        }
      }
      // Category / channel / amount / recurring filters only apply to the expense side —
      // income and transfers don't carry those dimensions in our data model.
      if (row.kind === "expense") {
        const e = row.data as Expense;
        if (categoryId && e.categoryId !== categoryId) return false;
        if (recurringOnly && !e.recurring) return false;
        if (minAmount !== "" && e.amount < Number(minAmount)) return false;
        if (maxAmount !== "" && e.amount > Number(maxAmount)) return false;
        if (payChannel) {
          const type = e.accountId ? accountTypeMap[e.accountId] : undefined;
          const matches = payChannel === "CASH" ? type === "CASH_WALLET"
            : payChannel === "CREDIT" ? type === "CREDIT_CARD"
            : type === "BANK_ACCOUNT";
          if (!matches) return false;
        }
      } else if (categoryId || recurringOnly) {
        // A category or recurring-only filter is active and this row isn't an expense — exclude it.
        return false;
      }
      if (!debouncedSearch.trim()) return true;
      const q = debouncedSearch.toLowerCase();
      if (row.kind === "expense") {
        const e = row.data as Expense;
        return (e.description ?? "").toLowerCase().includes(q) ||
               (e.categoryName ?? "").toLowerCase().includes(q) ||
               String(e.amount).includes(q);
      }
      if (row.kind === "income") {
        const inc = row.data as IncomeEntry;
        return (inc.description ?? "").toLowerCase().includes(q) ||
               (INCOME_SOURCES.find(s => s.value === inc.source)?.label ?? "").toLowerCase().includes(q) ||
               String(inc.amount).includes(q);
      }
      const t = row.data as AccountTransfer;
      return (t.description ?? "").toLowerCase().includes(q) ||
             t.fromAccountName.toLowerCase().includes(q) ||
             t.toAccountName.toLowerCase().includes(q) ||
             String(t.amount).includes(q);
    });
  }, [mergedRows, debouncedSearch, categoryId, recurringOnly, minAmount, maxAmount, payChannel, accountTypeMap, selectedAccountIds]);

  const allTotalPages = Math.max(1, Math.ceil(filteredMergedRows.length / ALL_PAGE_SIZE));
  const pagedMergedRows = filteredMergedRows.slice(allPage * ALL_PAGE_SIZE, (allPage + 1) * ALL_PAGE_SIZE);

  // Net of whatever's currently matched (income − expenses; transfers don't move net worth,
  // they just move money between your own accounts, so they're excluded from this total).
  const allTabNet = useMemo(() => filteredMergedRows.reduce((s, r) => {
    if (r.kind === "income")  return s + (r.data as IncomeEntry).amount;
    if (r.kind === "expense") return s - (r.data as Expense).amount;
    return s;
  }, 0), [filteredMergedRows]);

  // ─── Stat cards — Total Income / Total Expenses for the selected period ────
  // "Month" mode uses the analytics dashboard's server-side aggregate (no size cap, always
  // correct). Other modes fall back to summing the all-time fetch above, filtered to the
  // selected range — bounded by that fetch's 2000-row cap rather than the old 300-row one.
  const statTotals = useMemo(() => {
    // Deltas only make sense month-over-month, so they're only ever populated in "month" mode.
    // Uses the same pctChange() every other stat tile in the app uses (lib/utils) — it treats a
    // zero/missing previous value as a full +100% move rather than silently hiding the delta,
    // which is what caused Expenses/Net Savings to go quiet while Income kept showing one.
    if (dateMode === "month" && dashboardSummary) {
      const prevNet = prevDashboardSummary ? prevDashboardSummary.monthlyIncome - prevDashboardSummary.monthlyExpenses : undefined;
      const net = dashboardSummary.monthlyIncome - dashboardSummary.monthlyExpenses;
      return {
        income: dashboardSummary.monthlyIncome, expenses: dashboardSummary.monthlyExpenses,
        incomeDelta:      pctChange(dashboardSummary.monthlyIncome,   prevDashboardSummary?.monthlyIncome),
        expensesDelta:    pctChange(dashboardSummary.monthlyExpenses, prevDashboardSummary?.monthlyExpenses),
        netSavingsDelta:  pctChange(net, prevNet),
      };
    }
    const inRange = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
    return {
      income:   allTimeIncome.filter(i => inRange(i.incomeDate)).reduce((s, i) => s + i.amount, 0),
      expenses: allTimeExpenses.filter(e => inRange(e.expenseDate)).reduce((s, e) => s + e.amount, 0),
      incomeDelta: undefined, expensesDelta: undefined, netSavingsDelta: undefined,
    };
  }, [dateMode, dashboardSummary, prevDashboardSummary, allTimeIncome, allTimeExpenses, startDate, endDate]);

  // ─── Running balance ledger ──────────────────────────────────────────────────
  // A per-row "balance after this transaction" only means something as a chronological
  // replay anchored at the account's true opening balance — anchoring at currentBalance and
  // walking backward breaks the moment the viewed period isn't the most recent one. So this
  // replays every expense/income/transfer for each account, oldest to newest, from
  // account.openingBalance, independent of whatever date range is currently selected.
  //
  // Sign convention matches the backend's enrich() exactly: for liability accounts (credit
  // card, loan) an expense INCREASES what's owed and income/transfers-in pay it DOWN — the
  // opposite of an asset account. Getting this backwards would show a credit card's balance
  // shrinking every time you spend on it.
  const balanceMap = useMemo(() => {
    const isLiability = (accId: string) => {
      const type = accountTypeMap[accId];
      return type === "CREDIT_CARD" || type === "LOAN";
    };
    type LedgerEvent = { key: string; accountId: string; date: string; createdAt: string; delta: number };
    const events: LedgerEvent[] = [];
    allTimeExpenses.forEach(e => {
      if (!e.accountId) return;
      const base = -e.amount;
      events.push({ key: `expense-${e.id}`, accountId: e.accountId, date: e.expenseDate, createdAt: e.createdAt, delta: isLiability(e.accountId) ? -base : base });
    });
    allTimeIncome.forEach(i => {
      if (!i.accountId) return;
      const base = i.amount;
      events.push({ key: `income-${i.id}`, accountId: i.accountId, date: i.incomeDate, createdAt: i.createdAt, delta: isLiability(i.accountId) ? -base : base });
    });
    allTransfers.forEach(t => {
      if (t.fromAccountId) {
        const base = -t.amount;
        events.push({ key: `transfer-${t.id}-from`, accountId: t.fromAccountId, date: t.transferDate, createdAt: t.createdAt, delta: isLiability(t.fromAccountId) ? -base : base });
      }
      if (t.toAccountId) {
        const base = t.amount;
        events.push({ key: `transfer-${t.id}-to`, accountId: t.toAccountId, date: t.transferDate, createdAt: t.createdAt, delta: isLiability(t.toAccountId) ? -base : base });
      }
    });

    const byAccount = new Map<string, LedgerEvent[]>();
    events.forEach(ev => {
      if (!byAccount.has(ev.accountId)) byAccount.set(ev.accountId, []);
      byAccount.get(ev.accountId)!.push(ev);
    });

    const balances = new Map<string, number>();
    byAccount.forEach((accountEvents, accountId) => {
      const account = allAccounts.find(a => a.id === accountId);
      if (!account) return;
      accountEvents.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      let running = account.openingBalance;
      accountEvents.forEach(ev => {
        running += ev.delta;
        balances.set(ev.key, running);
      });
    });
    return balances;
  }, [allTimeExpenses, allTimeIncome, allTransfers, allAccounts, accountTypeMap]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const { user } = useAuthStore();
  const { data: familyMembersRaw = [] } = useFamilyMembers(user?.familyId);
  const familyMembers = familyMembersRaw.filter(m => m.id !== user?.id).map(m => ({ id: m.id, fullName: m.fullName }));

  const { mutate: createExpense, isPending: creating } = useCreateExpense();
  const { mutate: updateExpense, isPending: updating } = useUpdateExpense();
  const { mutate: deleteExpense }                      = useDeleteExpense();
  const { mutate: createIncome,  isPending: addingIncome }    = useCreateIncome();
  const { mutate: updateIncome,  isPending: updatingIncome }  = useUpdateIncome();
  const { mutate: deleteIncome }                              = useDeleteIncome();
  const { mutate: createTransfer, isPending: transferring }   = useTransfer();
  const { mutate: updateTransfer, isPending: updatingTransfer } = useUpdateTransfer();
  const { mutate: deleteTransfer }                            = useDeleteTransfer();

  // Most-used-first picker order (e.g. Groceries/Salary at the top) — separate from
  // defaultExpenseCategoryId/defaultIncomeSource below, which pick the recency-based default.
  const expenseCategoryUsage = useMemo(() => buildUsageCounts(allTimeExpenses, e => e.categoryId), [allTimeExpenses]);
  const incomeSourceUsage    = useMemo(() => buildUsageCounts(allTimeIncome, i => i.source), [allTimeIncome]);
  const categoryOptions = useMemo(() =>
    sortByUsage(categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color })), o => o.value, expenseCategoryUsage),
    [categories, expenseCategoryUsage]);
  const categoryName    = categories.find(c => c.id === categoryId)?.name;

  function resolvePaymentMethod(accountId: string | undefined) {
    if (!accountId) return undefined;
    const type = accountTypeMap[accountId];
    if (!type) return undefined;
    return type === "CASH_WALLET" ? "CASH" : type === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK_ACCOUNT";
  }

  const handleCreate = (values: ExpenseFormValues, splitWith?: SplitParticipant[]) => {
    const accountId = values.accountId || undefined;
    createExpense(
      { ...values, amount: Number(values.amount), accountId, paymentMethod: resolvePaymentMethod(accountId), splitWith },
      { onSuccess: () => setShowCreate(false) }
    );
  };

  const handleUpdate = (values: ExpenseFormValues) => {
    if (!editExpense) return;
    const accountId = values.accountId || undefined;
    updateExpense(
      { id: editExpense.id, payload: { ...values, amount: Number(values.amount), accountId, paymentMethod: resolvePaymentMethod(accountId) } },
      { onSuccess: () => setEditExpense(null) }
    );
  };

  const handleAddIncome = (values: IncomeFormValues) => {
    const d = new Date(values.incomeDate);
    createIncome(
      {
        source: values.source,
        amount: values.amount,
        incomeDate: values.incomeDate,
        periodMonth: d.getMonth() + 1,
        periodYear:  d.getFullYear(),
        accountId:   values.accountId || undefined,
        description: values.description || undefined,
        paymentMode: (() => {
          if (!values.accountId) return "CASH";
          const acc = allAccounts.find(a => a.id === values.accountId);
          return acc?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT";
        })(),
      },
      { onSuccess: () => setShowAddIncome(false) }
    );
  };

  const handleAddTransfer = (values: TransferFormValues) => {
    createTransfer(
      { fromAccountId: values.fromAccountId, toAccountId: values.toAccountId,
        amount: Number(values.amount), transferDate: values.transferDate,
        description: values.description || undefined },
      { onSuccess: () => setShowAddTransfer(false) }
    );
  };

  const handleUpdateIncome = (values: IncomeFormValues) => {
    if (!editIncome) return;
    const d = new Date(values.incomeDate);
    updateIncome(
      { id: editIncome.id, payload: {
        source: values.source, amount: values.amount,
        incomeDate: values.incomeDate,
        periodMonth: d.getMonth() + 1, periodYear: d.getFullYear(),
        accountId: values.accountId || undefined,
        description: values.description || undefined,
        paymentMode: (() => {
          if (!values.accountId) return "CASH";
          const acc = allAccounts.find(a => a.id === values.accountId);
          return acc?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT";
        })(),
      }},
      { onSuccess: () => setEditIncome(null) }
    );
  };

  const handleUpdateTransfer = (values: TransferFormValues) => {
    if (!editTransfer) return;
    updateTransfer(
      { id: editTransfer.id, payload: {
        amount: Number(values.amount), transferDate: values.transferDate,
        description: values.description || undefined,
      }},
      { onSuccess: () => setEditTransfer(null) }
    );
  };

  // Expense filter helpers
  const clearAllFilters = () => {
    setPayChannel(""); setCategoryId(""); setMinAmount(""); setMaxAmount("");
    setSortKey("date-desc"); setDateMode("month"); setRecurringOnly(false);
    setYear(now.getFullYear()); setMonth(now.getMonth() + 1);
    setCustomStart(""); setCustomEnd(""); setListPage(0);
  };

  // Read URL params on mount and apply tab + account filter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "transfers" || tab === "income" || tab === "all" || tab === "expenses") {
      setTxType(tab as TxType);
    }
    const accountId = searchParams.get("accountId");
    if (accountId) {
      setSelectedAccountIds([accountId]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setListPage(0); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startDate, endDate, debouncedSearch, categoryId, payChannel, minAmount, maxAmount, sortKey, recurringOnly]);

  useEffect(() => { setAllPage(0); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txType, dateMode, year, month, customStart, customEnd, debouncedSearch, categoryId, payChannel, minAmount, maxAmount, recurringOnly]);

  const activeFilterCount = [
    payChannel !== "", categoryId !== "", minAmount !== "" || maxAmount !== "",
    sortKey !== "date-desc", dateMode !== "month", recurringOnly,
  ].filter(Boolean).length;

  const expenses      = expenseData?.data ?? [];
  const serverTotal   = expenseData?.meta?.totalElements ?? 0;
  const totalPages    = expenseData?.meta?.totalPages ?? 1;

  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.expenseDate]) acc[e.expenseDate] = [];
    acc[e.expenseDate].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) =>
    sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));

  // Expenses-tab list header total — from the full filtered period (filteredMergedRows), not
  // the paginated `expenses` slice, so it doesn't silently only reflect whichever page is on screen.
  const expenseTabRows  = useMemo(() => filteredMergedRows.filter(r => r.kind === "expense"), [filteredMergedRows]);
  const expenseTabTotal = useMemo(() => expenseTabRows.reduce((s, r) => s + (r.data as Expense).amount, 0), [expenseTabRows]);

  const csvLabel = dateMode === "month" ? `${year}-${pad(month)}`
    : dateMode === "year" ? `${year}`
    : dateMode === "custom" ? `${customStart ?? "start"}-to-${customEnd ?? "end"}`
    : "all";

  const hasAccounts       = allAccounts.length > 0;
  const hasIncomeAccounts = allAccounts.some(a => a.accountType !== "CREDIT_CARD");

  // Shared fallback for the Expenses/Income/Transfers empty states — without it, a brand-new
  // user with zero accounts could still hit "Add Expense" etc. and land on a form whose
  // AccountPicker has nothing to pick from (the FAB blocks this path, but these buttons didn't).
  const addAccountCta = (
    <Link href="/accounts"
      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
      <Wallet className="w-4 h-4" /> Add an Account
    </Link>
  );

  function handleExport() {
    // Uses filteredMergedRows (period + filter scoped, not paginated) rather than the current
    // page slice, so the export always matches what "this period's data" actually means —
    // not just the 25 rows currently on screen.
    if (txType === "income")    { exportIncomeCsv(searchedIncome, csvLabel, accountMap); return; }
    if (txType === "transfers") { exportTransfersCsv(searchedTransfers, csvLabel); return; }
    if (txType === "expenses")  {
      exportCsv(filteredMergedRows.filter(r => r.kind === "expense").map(r => r.data as Expense), csvLabel, accountMap, accountTypeMap);
      return;
    }
    exportAllCsv(filteredMergedRows, csvLabel, accountMap);
  }

  // Date-range chips apply to every tab; category/amount/channel/recurring only ever filter the
  // expense side (Expenses tab, and expense rows within All), so they're kept separate and only
  // shown where they actually do something — otherwise a chip could sit there doing nothing on
  // the Income/Transfers tabs, which is more confusing than no chip at all.
  const dateChips: { label: string; clear: () => void }[] = [];
  if (dateMode === "year")      dateChips.push({ label: `Year ${year}`,   clear: () => setDateMode("month") });
  if (dateMode === "custom")    dateChips.push({ label: "Custom range",   clear: () => setDateMode("month") });
  if (dateMode === "all")       dateChips.push({ label: "All time",       clear: () => setDateMode("month") });

  const expenseChips: { label: string; clear: () => void }[] = [];
  if (payChannel === "CASH")    expenseChips.push({ label: "Cash only",    clear: () => setPayChannel("") });
  if (payChannel === "ACCOUNT") expenseChips.push({ label: "Bank account", clear: () => setPayChannel("") });
  if (payChannel === "CREDIT")  expenseChips.push({ label: "Credit card",  clear: () => setPayChannel("") });
  if (categoryId)               expenseChips.push({ label: categoryName ?? "Category", clear: () => setCategoryId("") });
  if (minAmount !== "")         expenseChips.push({ label: `Min ${currSymbol}${minAmount}`, clear: () => setMinAmount("") });
  if (maxAmount !== "")         expenseChips.push({ label: `Max ${currSymbol}${maxAmount}`, clear: () => setMaxAmount("") });
  if (sortKey !== "date-desc")  expenseChips.push({ label: ({"date-asc":"Oldest first","amount-desc":"Highest first","amount-asc":"Lowest first"} as Record<string,string>)[sortKey], clear: () => setSortKey("date-desc") });
  if (recurringOnly)            expenseChips.push({ label: "Recurring only", clear: () => setRecurringOnly(false) });

  const transferChips: { label: string; clear: () => void }[] = [];
  if (selectedAccountIds.length > 0) {
    transferChips.push({ label: `${selectedAccountIds.length} account${selectedAccountIds.length > 1 ? "s" : ""}`, clear: () => setSelectedAccountIds([]) });
  }

  const chips           = [...expenseChips, ...dateChips];
  const incomeTabChips   = dateChips;
  const transferTabChips = [...transferChips, ...dateChips];
  const allTabChips      = [...expenseChips, ...dateChips];

  // Smart default for a new expense's category: whichever category you used most recently;
  // if you've never logged one, fall back to whichever you use most often overall. Only
  // falls through to "nothing selected" for a genuinely brand-new account with no history.
  const defaultExpenseCategoryId = useMemo(() =>
    pickSmartDefault(allTimeExpenses, e => e.expenseDate, e => e.createdAt, e => e.categoryId),
    [allTimeExpenses]);

  // Same idea for income's source picker — Salary is the one universal fallback here (unlike
  // expense categories, most people's income really is salary-dominant) when there's no history yet.
  const defaultIncomeSource = useMemo((): IncomeSourceValue =>
    (pickSmartDefault(allTimeIncome, i => i.incomeDate, i => i.createdAt, i => i.source) as IncomeSourceValue) ?? "SALARY",
    [allTimeIncome]);

  const sharedFormProps = {
    categoryOptions,
    cashAccounts:   cashAccounts.map(a => ({ id: a.id, name: a.name, currentBalance: a.currentBalance })),
    bankAccounts:   bankAccounts.map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance, primary: a.primary })),
    creditAccounts: creditAccounts.map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance })),
  };

  // Grouped income rows (with sort)
  const incomeGroupedRaw = searchedIncome.reduce<Record<string, IncomeEntry[]>>((acc, i) => {
    if (!acc[i.incomeDate]) acc[i.incomeDate] = [];
    acc[i.incomeDate].push(i);
    return acc;
  }, {});
  const incomeGrouped = (incomeSort === "high" || incomeSort === "low")
    ? Object.fromEntries(Object.entries(incomeGroupedRaw).map(([date, items]) => [
        date,
        [...items].sort((a, b) => incomeSort === "high" ? b.amount - a.amount : a.amount - b.amount)
      ]))
    : incomeGroupedRaw;
  const incomeSortedDates = Object.keys(incomeGrouped).sort((a, b) =>
    incomeSort === "oldest" ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Grouped transfer rows (with sort)
  const transferGroupedRaw = searchedTransfers.reduce<Record<string, AccountTransfer[]>>((acc, t) => {
    if (!acc[t.transferDate]) acc[t.transferDate] = [];
    acc[t.transferDate].push(t);
    return acc;
  }, {});
  const transferGrouped = (transferSort === "high" || transferSort === "low")
    ? Object.fromEntries(Object.entries(transferGroupedRaw).map(([date, items]) => [
        date,
        [...items].sort((a, b) => transferSort === "high" ? b.amount - a.amount : a.amount - b.amount)
      ]))
    : transferGroupedRaw;
  const transferSortedDates = Object.keys(transferGrouped).sort((a, b) =>
    transferSort === "oldest" ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Merged "All" grouped
  const allGrouped = pagedMergedRows.reduce<Record<string, TxRow[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});
  const allSortedDates = Object.keys(allGrouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Transactions" subtitle="Track and manage all your money movements" onExport={handleExport} />

      {/* Expense modals */}
      {confirmId && (
        <ConfirmDialog open title="Delete Expense"
          description="This expense will be permanently deleted and cannot be undone."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteExpense(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {confirmIncomeId && (
        <ConfirmDialog open title="Delete Income Entry"
          description="This income entry will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteIncome(confirmIncomeId); setConfirmIncomeId(null); }}
          onCancel={() => setConfirmIncomeId(null)} />
      )}
      {confirmTransferId && (
        <ConfirmDialog open title="Delete Transfer"
          description="This transfer record will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteTransfer(confirmTransferId); setConfirmTransferId(null); }}
          onCancel={() => setConfirmTransferId(null)} />
      )}

      {/* Add/edit modals */}
      {(showCreate || editExpense) && (
        <TransactionModalOverlay onDismiss={() => { setShowCreate(false); setEditExpense(null); }}>
          {showCreate && (
            <ExpenseForm title="New Expense" defaultCategoryId={defaultExpenseCategoryId} {...sharedFormProps}
              familyMembers={familyMembers}
              onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
              isPending={creating} submitLabel="Add Expense" />
          )}
          {editExpense && (
            <ExpenseForm
              title={`Edit — ${editExpense.description || editExpense.categoryName || "Expense"}`}
              defaultValues={{ categoryId: editExpense.categoryId, accountId: editExpense.accountId ?? "",
                amount: editExpense.amount, description: editExpense.description ?? "", expenseDate: editExpense.expenseDate }}
              {...sharedFormProps}
              onSubmit={handleUpdate} onCancel={() => setEditExpense(null)}
              onDelete={() => { const id = editExpense.id; setEditExpense(null); setConfirmId(id); }}
              isPending={updating} submitLabel="Save Changes" />
          )}
        </TransactionModalOverlay>
      )}

      {(showAddIncome || editIncome) && (
        <TransactionModalOverlay onDismiss={() => { setShowAddIncome(false); setEditIncome(null); }}>
          {showAddIncome && (
            <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowAddIncome(false)}
              defaultSource={defaultIncomeSource} sourceUsageCounts={incomeSourceUsage}
              isPending={addingIncome} accounts={allAccounts} incomeCategories={incomeCategories} />
          )}
          {editIncome && (
            <IncomeForm
              defaultValues={{ source: editIncome.source as IncomeSourceValue, amount: editIncome.amount,
                incomeDate: editIncome.incomeDate, accountId: editIncome.accountId ?? "",
                description: editIncome.description ?? "" }}
              onSubmit={handleUpdateIncome} onCancel={() => setEditIncome(null)}
              onDelete={() => { const id = editIncome.id; setEditIncome(null); setConfirmIncomeId(id); }}
              sourceUsageCounts={incomeSourceUsage}
              isPending={updatingIncome} accounts={allAccounts} incomeCategories={incomeCategories} isEdit />
          )}
        </TransactionModalOverlay>
      )}

      {(showAddTransfer || editTransfer) && (
        <TransactionModalOverlay onDismiss={() => { setShowAddTransfer(false); setEditTransfer(null); }}>
          {showAddTransfer && (
            <TransferFormModal onSubmit={handleAddTransfer} onCancel={() => setShowAddTransfer(false)}
              isPending={transferring} accounts={allAccounts} />
          )}
          {editTransfer && (
            <TransferFormModal
              editTransferRef={editTransfer}
              onSubmit={handleUpdateTransfer} onCancel={() => setEditTransfer(null)}
              onDelete={() => { const id = editTransfer.id; setEditTransfer(null); setConfirmTransferId(id); }}
              isPending={updatingTransfer} accounts={allAccounts} isEdit />
          )}
        </TransactionModalOverlay>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4">

        {/* Toolbar — search, filters, import — shared across every tab */}
        <Toolbar
          search={search} setSearch={setSearch}
          onOpenFilters={() => setShowFilterPanel(true)}
          activeFilterCount={activeFilterCount}
          onImportStatement={() => setShowImportStatement(true)}
          hasAccounts={hasAccounts}
        />

        {showImportStatement && (
          <ImportStatementModal onClose={() => setShowImportStatement(false)}
            bankAccounts={sharedFormProps.bankAccounts} cashAccounts={sharedFormProps.cashAccounts} />
        )}

        {/* Shared date controls */}
        <DateControls
          dateMode={dateMode} setDateMode={setDateMode}
          year={year} setYear={setYear}
          month={month} setMonth={setMonth}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
        />

        {/* Stat cards — always visible, reflect the selected date range regardless of tab */}
        <StatCards
          income={statTotals.income} expenses={statTotals.expenses}
          incomeDelta={statTotals.incomeDelta} expensesDelta={statTotals.expensesDelta}
          netSavingsDelta={statTotals.netSavingsDelta}
          transactionCount={mergedRows.length}
        />

        {/* Type tabs */}
        <TypeTabs value={txType} onChange={v => { setTxType(v); }} counts={txTypeCounts} />

        <FilterPanel
          open={showFilterPanel} onClose={() => setShowFilterPanel(false)} txType={txType}
          categories={categories} categoryId={categoryId} setCategoryId={setCategoryId}
          payChannel={payChannel} setPayChannel={setPayChannel}
          minAmount={minAmount} setMinAmount={setMinAmount} maxAmount={maxAmount} setMaxAmount={setMaxAmount}
          recurringOnly={recurringOnly} setRecurringOnly={setRecurringOnly}
          currSymbol={currSymbol}
          sortKey={sortKey} setSortKey={setSortKey}
          incomeSort={incomeSort} setIncomeSort={setIncomeSort}
          transferSort={transferSort} setTransferSort={setTransferSort}
          allAccounts={allAccounts} selectedAccountIds={selectedAccountIds} setSelectedAccountIds={setSelectedAccountIds}
          onClearAll={clearAllFilters} activeFilterCount={activeFilterCount}
        />

        {/* ── EXPENSES TAB ─────────────────────────────────────────────────── */}
        {txType === "expenses" && (
          <div className="space-y-3">
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
              </div>
            )}

            {/* Expense list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Expenses</h3>
                <div className="flex items-center gap-3">
                  {expenseTabTotal > 0 && <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(expenseTabTotal)}</span>}
                  <span className="text-xs text-muted-foreground/80">{expenseTabRows.length} total</span>
                </div>
              </div>
              {expensesLoading ? <TableRowSkeleton rows={6} /> : expenses.length === 0 ? (
                <EmptyState icon={Receipt} title={!hasAccounts ? "No accounts yet" : "No expenses found"}
                  description={
                    !hasAccounts ? "Add a bank, cash, or credit account before logging expenses."
                      : activeFilterCount > 0 ? "No expenses match the active filters." : "Track your spending by adding your first expense."
                  }
                  action={
                    !hasAccounts ? addAccountCta
                      : activeFilterCount > 0
                      ? <button onClick={clearAllFilters} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                      : <button onClick={() => setShowCreate(true)}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                          <Plus className="w-4 h-4" /> Add Expense
                        </button>
                  } />
              ) : (
                <div>
                  {sortedDates.map(date => {
                    const dayTotal = grouped[date].reduce((s, e) => s + e.amount, 0);
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                          <span className="text-xs font-semibold text-red-500/70 tabular-nums">−{fmt(dayTotal)}</span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {grouped[date].map(expense => (
                            <ExpenseRow key={expense.id} expense={expense}
                              accountName={expense.accountId ? accountMap[expense.accountId] : undefined}
                              onEdit={() => { setShowCreate(false); setEditExpense(expense); }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        {listPage * PAGE_SIZE + 1}–{Math.min((listPage + 1) * PAGE_SIZE, serverTotal)} of {serverTotal}
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setListPage(0)} disabled={listPage === 0} aria-label="First page"
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                        <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={listPage === 0} aria-label="Previous page"
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground px-2 tabular-nums">{listPage + 1} / {totalPages}</span>
                        <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={listPage >= totalPages - 1} aria-label="Next page"
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setListPage(totalPages - 1)} disabled={listPage >= totalPages - 1} aria-label="Last page"
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INCOME TAB ───────────────────────────────────────────────────── */}
        {txType === "income" && (
          <div className="space-y-3">
            {incomeTabChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {incomeTabChips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Income</h3>
                <div className="flex items-center gap-3">
                  {searchedIncome.length > 0 && (
                    <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                      +{fmt(searchedIncome.reduce((s, i) => s + i.amount, 0))}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/80">{searchedIncome.length} total</span>
                </div>
              </div>
              {incomeLoading ? <TableRowSkeleton rows={4} /> : searchedIncome.length === 0 ? (
                <EmptyState icon={ArrowUpRight} title={!hasIncomeAccounts ? "No accounts yet" : "No income this period"}
                  description={!hasIncomeAccounts ? "Add a bank or cash account before recording income." : "Record income to track what's coming in."}
                  action={
                    !hasIncomeAccounts ? addAccountCta
                      : <button onClick={() => setShowAddIncome(true)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                      <Plus className="w-4 h-4" /> Add Income
                    </button>
                  } />
              ) : (
                <div>
                  {incomeSortedDates.map(date => (
                    <div key={date}>
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                        <span className="text-xs font-semibold text-emerald-500/80 tabular-nums">
                          +{fmt(incomeGrouped[date].reduce((s, i) => s + i.amount, 0))}
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {incomeGrouped[date].map(entry => (
                          <IncomeRow key={entry.id} entry={entry}
                            accountName={entry.accountId ? accountMap[entry.accountId] : undefined}
                            onEdit={() => { setShowAddIncome(false); setEditIncome(entry); }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TRANSFERS TAB ────────────────────────────────────────────────── */}
        {txType === "transfers" && (
          <div className="space-y-3">
            {transferTabChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transferTabChips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Transfers</h3>
                <div className="flex items-center gap-3">
                  {searchedTransfers.length > 0 && (
                    <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400 tabular-nums">
                      {fmt(searchedTransfers.reduce((s, t) => s + t.amount, 0))}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/80">{searchedTransfers.length} total</span>
                </div>
              </div>
              {transfersLoading ? <TableRowSkeleton rows={4} /> : searchedTransfers.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title={allAccounts.length < 2 ? "Need at least 2 accounts" : "No transfers this period"}
                  description={allAccounts.length < 2 ? "Transfers move money between two of your own accounts — add another account first." : "Move money between your accounts."}
                  action={
                    allAccounts.length < 2 ? addAccountCta
                      : <button onClick={() => setShowAddTransfer(true)}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                      <Plus className="w-4 h-4" /> New Transfer
                    </button>
                  } />
              ) : (
                <div>
                  {transferSortedDates.map(date => (
                    <div key={date}>
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                        <span className="text-xs font-semibold text-indigo-500/70 tabular-nums">
                          {fmt(transferGrouped[date].reduce((s, t) => s + t.amount, 0))}
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {transferGrouped[date].map(transfer => (
                          <TransferRow key={transfer.id} transfer={transfer}
                            onEdit={() => { setShowAddTransfer(false); setEditTransfer(transfer); }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALL TAB ──────────────────────────────────────────────────────── */}
        {txType === "all" && (
          <div className="space-y-3">
            {allTabChips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTabChips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">All Transactions</h3>
                <div className="flex items-center gap-3">
                  {filteredMergedRows.length > 0 && (
                    <span className={cn("text-xs font-bold tabular-nums", allTabNet >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                      {allTabNet >= 0 ? "+" : "−"}{fmt(Math.abs(allTabNet))}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/80">{filteredMergedRows.length} total</span>
                </div>
              </div>
              {(expensesLoading || incomeLoading || transfersLoading) ? <TableRowSkeleton rows={6} /> :
               filteredMergedRows.length === 0 ? (
                <EmptyState icon={Receipt}
                  title={mergedRows.length === 0 ? "No transactions this period" : "No transactions match your filters"}
                  description={
                    mergedRows.length === 0
                      ? "Add your first transaction using the button above."
                      : "Try clearing the search or filters to see everything again."
                  }
                  action={
                    mergedRows.length > 0 && (activeFilterCount > 0 || search)
                      ? <button onClick={() => { clearAllFilters(); setSearch(""); }} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                      : undefined
                  } />
              ) : (
                <div>
                  {allSortedDates.map(date => (
                    <div key={date}>
                      <div className="px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {allGrouped[date].map((row, i) => {
                          if (row.kind === "expense") {
                            const e = row.data as Expense;
                            const catIcon2  = getCategoryIcon({ name: e.categoryName ?? "", icon: e.categoryIcon });
                            const catColor2 = getCategoryColor(e.categoryName ?? "", e.categoryColor);
                            return (
                              <button type="button" key={i} onClick={() => { setShowCreate(false); setEditExpense(e); }}
                                aria-label={`Edit ${e.description || e.categoryName || "expense"}, ${fmt(e.amount)}`}
                                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
                                <PremiumIcon icon={catIcon2} hex={catColor2} size="sm" className="w-9 h-9" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate leading-5">
                                    {e.description || e.categoryName || "Expense"}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {e.categoryName && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                        style={{ backgroundColor: catColor2 + "18", color: catColor2 }}>{e.categoryName}</span>
                                    )}
                                    {e.accountId && accountMap[e.accountId] && (
                                      <span className="text-xs text-muted-foreground/50">{accountMap[e.accountId]}</span>
                                    )}
                                    {e.paymentMethod === "CREDIT_CARD" && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 font-medium">Card</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">−{fmt(e.amount)}</p>
                                  {e.accountId && balanceMap.has(`expense-${e.id}`) && (
                                    <p className="text-[11px] text-muted-foreground/50 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(`expense-${e.id}`)!)}</p>
                                  )}
                                </div>
                              </button>
                            );
                          }
                          if (row.kind === "income") {
                            const income = row.data as IncomeEntry;
                            const src2 = INCOME_ICON_MAP[income.source] ?? INCOME_ICON_MAP.OTHER;
                            return (
                              <button type="button" key={i} onClick={() => setEditIncome(income)}
                                aria-label={`Edit ${income.description || "income entry"}, ${fmt(income.amount)}`}
                                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
                                <PremiumIcon icon={src2.icon} hex={src2.color} size="sm" className="w-9 h-9" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate leading-5">
                                    {income.description || INCOME_SOURCES.find(s => s.value === income.source)?.label || income.source}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                      style={{ backgroundColor: src2.color + "20", color: src2.color }}>
                                      {INCOME_SOURCES.find(s => s.value === income.source)?.label ?? income.source}
                                    </span>
                                    {income.accountId && accountMap[income.accountId] && (
                                      <span className="text-xs text-muted-foreground/50">{accountMap[income.accountId]}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">+{fmt(income.amount)}</p>
                                  {income.accountId && balanceMap.has(`income-${income.id}`) && (
                                    <p className="text-[11px] text-muted-foreground/50 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(`income-${income.id}`)!)}</p>
                                  )}
                                </div>
                              </button>
                            );
                          }
                          const transfer = row.data as AccountTransfer;
                          const isAdj  = transfer.adjustment;
                          const isDebt = transfer.debt;
                          const isIn   = !!transfer.toAccountId;
                          const txnSign = (isAdj || isDebt) ? (isIn ? "+" : "−") : "";
                          // A one-sided transfer (debt/adjustment) only ever has the "from" or the
                          // "to" side set, never both — show whichever side actually has a balance
                          // entry instead of assuming "from" (which left money received back with
                          // no balance shown at all, since only toAccountId is set on that leg).
                          const balanceKey = balanceMap.has(`transfer-${transfer.id}-from`)
                            ? `transfer-${transfer.id}-from`
                            : `transfer-${transfer.id}-to`;
                          return (
                            <button type="button" key={i} onClick={() => setEditTransfer(transfer)}
                              aria-label={`Edit transfer, ${fmt(transfer.amount)}`}
                              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
                              <PremiumIcon icon={isDebt ? (isIn ? HandCoins : CreditCard) : isAdj ? RefreshCw : ArrowLeftRight}
                                hex={isDebt ? (isIn ? "#14b8a6" : "#f43f5e") : undefined}
                                tone={isDebt ? undefined : isAdj ? "gray" : "indigo"} size="sm" className="w-9 h-9" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate leading-5">
                                  {transfer.description || `${transfer.fromAccountName} → ${transfer.toAccountName}`}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {isDebt ? (
                                    <DebtBadge debtLabel={transfer.debtLabel} debtContactName={transfer.debtContactName} />
                                  ) : (
                                    <span className="text-xs text-muted-foreground/60">{transfer.fromAccountName} → {transfer.toAccountName}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={cn("text-sm font-bold tabular-nums",
                                  isDebt ? (isIn ? "text-teal-500 dark:text-teal-400" : "text-rose-500 dark:text-rose-400")
                                    : isAdj ? "text-muted-foreground" : "text-indigo-500 dark:text-indigo-400")}>
                                  {txnSign}{fmt(transfer.amount)}
                                </p>
                                {balanceMap.has(balanceKey) && (
                                  <p className="text-[11px] text-muted-foreground/50 tabular-nums mt-0.5">Bal {fmt(balanceMap.get(balanceKey)!)}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* All-tab pagination */}
                  {allTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        {allPage * ALL_PAGE_SIZE + 1}–{Math.min((allPage + 1) * ALL_PAGE_SIZE, mergedRows.length)} of {mergedRows.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setAllPage(0)} disabled={allPage === 0} aria-label="First page"
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                        <button onClick={() => setAllPage(p => Math.max(0, p - 1))} disabled={allPage === 0} aria-label="Previous page"
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground px-2 tabular-nums">{allPage + 1} / {allTotalPages}</span>
                        <button onClick={() => setAllPage(p => Math.min(allTotalPages - 1, p + 1))} disabled={allPage >= allTotalPages - 1} aria-label="Next page"
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setAllPage(allTotalPages - 1)} disabled={allPage >= allTotalPages - 1} aria-label="Last page"
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

</div>
      </main>

      {/* ── Floating Action Button — hidden while the filter sheet covers the screen ── */}
      {!showFilterPanel && (
        <FloatingActionButton actions={[
          { icon: Receipt,        label: "Add Expense", color: "rose",    onClick: () => { setShowCreate(true); setEditExpense(null); }, disabled: allAccounts.length === 0,
            disabledReason: "Add an account first" },
          { icon: Banknote,       label: "Add Income",  color: "emerald", onClick: () => { setShowAddIncome(true); setEditIncome(null); }, disabled: allAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0,
            disabledReason: "Add a bank or cash account first" },
          { icon: ArrowLeftRight, label: "Transfer",    color: "indigo",  onClick: () => { setShowAddTransfer(true); setEditTransfer(null); }, disabled: allAccounts.length < 2,
            disabledReason: "Add at least 2 accounts first" },
        ]} />
      )}
    </div>
  );
}
