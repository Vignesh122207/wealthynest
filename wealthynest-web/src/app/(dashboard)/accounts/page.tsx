"use client";

import { useMemo, useState } from "react";
import {
  Plus, Wallet, Trash2, Archive,
  X, ChevronDown, LayoutGrid, ArchiveRestore,
  CreditCard, Landmark, HandCoins, TrendingUp,
} from "lucide-react";
import { ACCOUNT_TYPE_META } from "@/lib/accountTypeMeta";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { BankLogo } from "@/components/icons/BankLogo";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { ExpenseForm } from "@/components/transactions/ExpenseForm";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { BigAmountInput } from "@/components/transactions/BigAmountInput";
import { IncomeForm, type IncomeFormValues, type IncomeSourceValue } from "@/components/transactions/IncomeForm";
import { TransferFormModal, type TransferFormValues } from "@/components/transactions/TransferFormModal";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import type { ExpenseFormValues } from "@/features/expenses/schemas/expense.schema";
import {
  useAccounts, useArchivedAccounts, useCreateAccount, useUpdateAccount,
  useDeleteAccount, useArchiveAccount, useUnarchiveAccount, useSetPrimaryAccount,
  useTransfer, useAdjustBalance, useRecordLoanPayment,
} from "@/features/accounts/hooks/useAccounts";
import { BankNameInput } from "@/features/accounts/components/BankNameInput";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";
import { AddMoreCard } from "@/features/accounts/components/AddMoreCard";
import { AccountCard } from "@/features/accounts/components/AccountCard";
import { LoanCard } from "@/features/accounts/components/LoanCard";
import { downloadAccountStatement } from "@/features/accounts/utils/downloadAccountStatement";
import { ImportStatementModal } from "@/features/statementimport/components/ImportStatementModal";
import {
  createAccountSchema, LOAN_TYPE_OPTIONS, LOAN_TYPE_LABELS, type CreateAccountForm,
} from "@/features/accounts/schemas/account.schema";
import { useExpenses, useCreateExpense } from "@/features/expenses/hooks/useExpenses";
import { useIncome, useCreateIncome } from "@/features/income/hooks/useIncome";
import { useDebts } from "@/features/debts/hooks/useDebts";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useCreateRecurringIncome } from "@/features/recurringIncome/hooks/useRecurringIncome";
import { buildUsageCounts, pickSmartDefault } from "@/lib/mostUsed";
import type { AccountType, WalletAccount } from "@/features/accounts/types/account.types";
import { INDIAN_BANKS, STOCK_BROKERS } from "@/lib/constants";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { toast } from "sonner";

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalType = "none" | "create" | "addMoney" | "addExpense" | "transfer" | "edit" | "import";
type ConfirmState = { title: string; message: string; onConfirm: () => void } | null;

// Matches ACCOUNT_TYPE_META's own color family per account type — same template as the
// Investments/Transactions/Debts tab bars (solid-fill pill per type, neutral slate for "All").
const SECTION_ACTIVE_BG: Record<"all" | "bank" | "cash" | "cc" | "loan" | "invest", string> = {
  all:    "bg-slate-600",
  bank:   "bg-indigo-600",
  cash:   "bg-emerald-600",
  invest: "bg-cyan-600",
  cc:     "bg-pink-600",
  loan:   "bg-red-600",
};

export default function AccountsPage() {
  const { fmt } = useAmountFormatter();
  const now = new Date();
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";
  const [modal, setModal]              = useState<ModalType>("none");
  const [sectionFilter, setSectionFilter] = useState<"all" | "bank" | "cash" | "cc" | "loan" | "invest">("all");
  const [bankInput, setBankInput]      = useState("");
  const [editAccount, setEditAccount]  = useState<WalletAccount | null>(null);
  const [preAccount, setPreAccount]    = useState<WalletAccount | null>(null);
  const [showCCDetails, setShowCCDetails] = useState(false);
  const [confirm, setConfirm]          = useState<ConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<WalletAccount | null>(null);
  const [alsoDeleteTx, setAlsoDeleteTx] = useState(false);

  const [showArchived, setShowArchived]      = useState(false);
  const { data: accounts = [], isLoading }   = useAccounts();
  const { data: archivedAccounts = [] }      = useArchivedAccounts();
  const { data: allDebts  = [] }           = useDebts();
  const { data: categories = [] }          = useCategories("EXPENSE");
  const { data: incomeCategories = [] }    = useCategories("INCOME");

  // Same "last used, else most used" default as the Transactions page's Add Expense/Income —
  // reused via pickSmartDefault so opening these forms from an account card doesn't drop back to
  // an empty category picker just because it's a different entry point into the same forms.
  const { data: allTimeExpensesData }      = useExpenses({ size: 2000, sortDir: "asc", includeDebt: true });
  const allTimeExpenses = useMemo(() => allTimeExpensesData?.data ?? [], [allTimeExpensesData]);
  const { data: allTimeIncome = [] }       = useIncome(undefined, undefined, true);
  const defaultExpenseCategoryId = useMemo(() =>
    pickSmartDefault(allTimeExpenses, e => e.expenseDate, e => e.createdAt, e => e.categoryId),
    [allTimeExpenses]);
  const defaultIncomeSource = useMemo((): IncomeSourceValue =>
    (pickSmartDefault(allTimeIncome, i => i.incomeDate, i => i.createdAt, i => i.source) as IncomeSourceValue) ?? "SALARY",
    [allTimeIncome]);
  const incomeSourceUsage = useMemo(() => buildUsageCounts(allTimeIncome, i => i.source), [allTimeIncome]);

  const [payLoan,   setPayLoan]   = useState<WalletAccount | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payFrom,   setPayFrom]   = useState("");
  // Balance reconciliation, folded into the Edit form itself rather than a separate modal —
  // initialized from editAccount.currentBalance when the edit form opens (see openEdit below).
  const [actualBalance, setActualBalance] = useState("");

  const { mutate: createAccount, isPending: creating }        = useCreateAccount();
  const { mutate: updateAccount, isPending: updating }        = useUpdateAccount();
  const { mutate: doAdjustBalance, isPending: adjusting }     = useAdjustBalance();
  const { mutate: deleteAccount }                             = useDeleteAccount();
  const { mutate: archiveAccount }                            = useArchiveAccount();
  const { mutate: unarchiveAccount }                          = useUnarchiveAccount();
  const { mutate: setPrimaryAccount, isPending: settingPrimary } = useSetPrimaryAccount();
  const { mutate: doTransfer, isPending: transferring }       = useTransfer();
  const { mutate: recordLoanPayment, isPending: payingLoan }  = useRecordLoanPayment();
  const { mutate: createIncome, isPending: addingMoney }      = useCreateIncome();
  const { mutate: createRecurringIncome }                     = useCreateRecurringIncome();
  const { mutate: createExpense, isPending: addingExpense }   = useCreateExpense();

  const createForm = useForm<CreateAccountForm>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { accountType: "CASH_WALLET", name: "Cash Wallet", openingBalance: undefined as any },
  });

  const cashAccounts      = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts      = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const emergencyAccounts = accounts.filter(a => a.accountType === "EMERGENCY_FUND");
  const creditCards       = accounts.filter(a => a.accountType === "CREDIT_CARD");
  const loanAccounts      = accounts.filter(a => a.accountType === "LOAN");
  const investAccounts    = accounts.filter(a => a.accountType === "INVESTMENT");

  const SECTION_TYPES: Record<Exclude<typeof sectionFilter, "all">, AccountType[]> = {
    bank: ["BANK_ACCOUNT"], cash: ["CASH_WALLET", "EMERGENCY_FUND"],
    invest: ["INVESTMENT"], cc: ["CREDIT_CARD"], loan: ["LOAN"],
  };
  const filteredArchived = sectionFilter === "all"
    ? archivedAccounts
    : archivedAccounts.filter(a => SECTION_TYPES[sectionFilter].includes(a.accountType));

  const totalBalance   = [...cashAccounts, ...bankAccounts].reduce((s, a) => s + a.currentBalance, 0);
  const bankBalance    = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const cashBalance    = cashAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const emergencyBal   = emergencyAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const investBalance  = investAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const creditCardDebt = creditCards.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);
  const loanDebt       = loanAccounts.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);

  // Total balance = everything you own outright (cash, bank, emergency fund, broker cash) —
  // matches the dashboard's own "Total Balance" widget; credit cards and loans are liabilities,
  // already broken out in their own stat cards below, so they're not netted in here.
  const totalAssetsAcrossAccounts = totalBalance + emergencyBal + investBalance;

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));

  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirm({ title, message, onConfirm });

  const openCreate = (type: AccountType) => {
    setBankInput("");
    setShowCCDetails(false);
    createForm.reset({
      accountType: type, openingBalance: undefined as any,
      name: type === "CASH_WALLET" ? "Cash Wallet" : type === "EMERGENCY_FUND" ? "Emergency Fund"
        : type === "INVESTMENT" ? "Investment Account" : type === "CREDIT_CARD" ? "Credit Card" : type === "LOAN" ? "Loan" : "",
    });
    setModal("create");
  };

  const openAddMoney = (account?: WalletAccount) => {
    setPreAccount(account ?? null);
    setModal("addMoney");
  };

  const [lockedExpenseAccount, setLockedExpenseAccount] = useState<WalletAccount | null>(null);

  const openAddExpense = (account?: WalletAccount) => {
    setLockedExpenseAccount(account ?? null);
    setModal("addExpense");
  };

  const [payBillMode, setPayBillMode] = useState(false);
  const openTransfer = (account?: WalletAccount, payBill = false) => {
    setPreAccount(account ?? null);
    setPayBillMode(payBill);
    setModal("transfer");
  };

  const openImportStatement = (account: WalletAccount) => {
    setPreAccount(account);
    setModal("import");
  };

  const openEdit = (account: WalletAccount) => {
    setEditAccount(account);
    setBankInput(account.bankName ?? "");
    setShowCCDetails(!!(account.creditLimit || account.statementDay));
    createForm.reset({
      accountType: account.accountType, name: account.name,
      bankName: account.bankName, accountNumber: account.accountNumber,
      openingBalance: account.openingBalance,
      lowBalanceThreshold: account.lowBalanceThreshold,
      creditLimit: account.creditLimit, statementDay: account.statementDay,
      paymentDueDay: account.paymentDueDay, apr: account.apr,
      loanType: account.loanType, principalAmount: account.principalAmount,
      emiAmount: account.emiAmount, emiDay: account.emiDay,
      autopayAccountId: account.autopayAccountId ?? "", loanEndDate: account.loanEndDate,
    });
    setActualBalance(String(account.currentBalance));
    setModal("edit");
  };

  const close = () => { setModal("none"); setEditAccount(null); setPreAccount(null); setLockedExpenseAccount(null); setActualBalance(""); };

  // Types whose form collects a bank / lender / broker name via BankNameInput
  const usesBankInput = (t: AccountType) =>
    t === "BANK_ACCOUNT" || t === "CREDIT_CARD" || t === "LOAN" || t === "INVESTMENT";

  const onCreateSubmit = (v: CreateAccountForm) => {
    const withBank = usesBankInput(v.accountType);
    createAccount({
      ...v,
      bankName:      withBank ? bankInput || undefined : undefined,
      accountNumber: withBank ? v.accountNumber || undefined : undefined,
      autopayAccountId: v.autopayAccountId || undefined,
      loanEndDate:      v.loanEndDate || undefined,
    } as Parameters<typeof createAccount>[0], { onSuccess: close });
  };

  const onEditSubmit = (v: CreateAccountForm) => {
    if (!editAccount) return;
    const withBank = usesBankInput(editAccount.accountType);
    // openingBalance isn't user-editable here (balance changes go through the separate
    // adjust-balance call below) — but the backend's update endpoint shares CreateAccountRequest
    // with create, where it's required, so the account's own unchanged value must ride along.
    const { openingBalance: _ob, ...rest } = v;
    const derivedName = (() => {
      switch (editAccount.accountType) {
        case "INVESTMENT":  return bankInput || editAccount.name;
        case "CREDIT_CARD": return bankInput ? `${bankInput} Card` : editAccount.name;
        case "LOAN": {
          const label = LOAN_TYPE_LABELS[v.loanType ?? ""];
          return label ? `${bankInput} ${label}`.trim() : (bankInput || editAccount.name);
        }
        default: return v.name || editAccount.name;
      }
    })();
    // Balance reconciliation rides along with the same submit — only fires the extra adjust-balance
    // call when the "Actual balance" field was actually changed from what the app already shows.
    const target = parseFloat(actualBalance);
    const balanceChanged = !isNaN(target) && target !== editAccount.currentBalance;

    updateAccount({ id: editAccount.id, payload: {
      ...rest,
      openingBalance: editAccount.openingBalance,
      name:          derivedName,
      bankName:      withBank ? bankInput || undefined : undefined,
      accountNumber: withBank ? v.accountNumber || undefined : undefined,
      autopayAccountId: v.autopayAccountId || undefined,
      loanEndDate:      v.loanEndDate || undefined,
    } }, {
      onSuccess: () => {
        if (balanceChanged) doAdjustBalance({ id: editAccount.id, targetBalance: target }, { onSuccess: close });
        else close();
      },
    });
  };

  const handleAddIncome = (v: IncomeFormValues, recurring?: { dayOfMonth: number }) => {
    const d = new Date(v.incomeDate);
    const target = accounts.find(a => a.id === v.accountId);
    createIncome({ accountId: v.accountId, source: v.source,
      paymentMode: target?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT",
      amount: Number(v.amount), description: v.description, incomeDate: v.incomeDate,
      periodMonth: d.getMonth() + 1, periodYear: d.getFullYear() }, {
      onSuccess: () => {
        if (recurring) {
          createRecurringIncome({
            accountId:   v.accountId,
            source:      v.source,
            amount:      Number(v.amount),
            description: v.description,
            dayOfMonth:  recurring.dayOfMonth,
          });
        }
        close();
      },
    });
  };

  const handleAddExpense = (v: ExpenseFormValues) => {
    const target = accounts.find(a => a.id === v.accountId);
    const paymentMethod = target?.accountType === "CASH_WALLET" ? "CASH"
      : target?.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK_ACCOUNT";
    createExpense({ accountId: v.accountId, categoryId: v.categoryId, amount: Number(v.amount),
      description: v.description, expenseDate: v.expenseDate, paymentMethod }, { onSuccess: close });
  };

  const handleAddTransfer = (v: TransferFormValues) => {
    doTransfer({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId,
      amount: Number(v.amount), description: v.description, transferDate: v.transferDate },
      { onSuccess: close });
  };

  const creditLimitField      = createForm.register("creditLimit");
  const watchedType           = createForm.watch("accountType");
  const activeType            = modal === "create" ? watchedType : (editAccount?.accountType ?? watchedType);
  const isCCForm              = activeType === "CREDIT_CARD";
  const isBankForm            = activeType === "BANK_ACCOUNT";
  const isLoanForm            = activeType === "LOAN";
  const isInvForm             = activeType === "INVESTMENT";
  const isSimpleType          = activeType === "CASH_WALLET" || activeType === "EMERGENCY_FUND";

  // Balance-reconciliation preview for the Edit form's "Actual balance" field.
  const editBalanceTarget     = parseFloat(actualBalance);
  const editBalanceCurrent    = editAccount?.currentBalance ?? 0;
  const editBalanceDiff       = editBalanceTarget - editBalanceCurrent;
  const editBalanceIsPositive = editBalanceDiff > 0;
  // For a liability, a higher outstanding is bad (an unlogged charge) and a lower one is good
  // (an unlogged payment) — the inverse of what "positive diff" means for an asset.
  const editBalanceGoodDirection = isCCForm || isLoanForm ? !editBalanceIsPositive : editBalanceIsPositive;
  const editBalanceAdjustLabel = isCCForm || isLoanForm
    ? (editBalanceIsPositive ? "Expense adjustment" : "Payment adjustment")
    : (editBalanceIsPositive ? "Income adjustment" : "Expense adjustment");

  const sharedCardProps = (a: WalletAccount) => ({
    onEdit:       () => openEdit(a),
    onSetPrimary:     () => { if (!settingPrimary) setPrimaryAccount(a.id); },
    settingPrimary,
  });

  // One dispatcher for the unified "All Accounts" grid — every non-loan type renders via the
  // shared AccountCard (which already branches internally for the Credit Card's premium look);
  // Loan keeps its own bespoke layout (progress bar, EMI chips, Record Payment).
  const renderAccountCard = (a: WalletAccount) => a.accountType === "LOAN" ? (
    <LoanCard key={a.id} account={a}
      onDownload={() => downloadAccountStatement(a)}
      onEdit={() => openEdit(a)}
      onRecordPayment={() => { setPayLoan(a); setPayAmount(a.emiAmount ? String(a.emiAmount) : ""); setPayFrom(a.autopayAccountId ?? ""); }} />
  ) : (
    <AccountCard key={a.id} account={a}
      linkedDebts={a.accountType === "INVESTMENT" ? [] : allDebts.filter(d => d.accountId === a.id)}
      onAddMoney={() => openAddMoney(a)}
      onAddExpense={() => openAddExpense(a)}
      onTransfer={() => openTransfer(a, a.accountType === "CREDIT_CARD")}
      onImportStatement={
        a.accountType === "BANK_ACCOUNT" || a.accountType === "CASH_WALLET"
          ? () => openImportStatement(a) : undefined
      }
      {...sharedCardProps(a)} />
  );

  const allAccountsOrdered = [...bankAccounts, ...cashAccounts, ...emergencyAccounts, ...investAccounts, ...creditCards, ...loanAccounts];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Accounts" subtitle="All your cash, bank, credit, and investment accounts in one place" />

      {confirm && (
        <ConfirmDialog open title={confirm.title} description={confirm.message}
          confirmLabel={confirm.title.startsWith("Archive") ? "Archive" : confirm.title.startsWith("Restore") ? "Restore" : "Delete"}
          danger={!confirm.title.startsWith("Restore")}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}

      {/* Its own custom card (not the generic ConfirmDialog above) — matches the same premium
          chrome as the rest of the app's forms (gradient bar, glossy PremiumIcon header, gradient
          CTA) instead of the plain warning-triangle look, and needs the live "also delete
          transactions" checkbox that a pre-bound askConfirm closure can't see update. */}
      {deleteTarget && (
        <TransactionModalOverlay onDismiss={() => setDeleteTarget(null)} maxWidth="max-w-sm">
          <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
            <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
            <div className="p-5">
              <FormModalHeader icon={Trash2} tone="red" title="Delete Account" onClose={() => setDeleteTarget(null)} />
              <p className="text-sm text-muted-foreground -mt-2 mb-4">
                Delete <span className="font-medium text-foreground">&quot;{deleteTarget.name}&quot;</span>? This can&apos;t be undone.
              </p>
              <label className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-all",
                alsoDeleteTx ? "border-red-500/40 bg-red-500/8" : "border-border bg-muted/40 hover:bg-muted/60")}>
                <input type="checkbox" checked={alsoDeleteTx} onChange={e => setAlsoDeleteTx(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-red-500 shrink-0" />
                <span className="text-xs leading-snug">
                  <span className="font-medium text-foreground">Also delete its expense and income entries</span>
                  <br />
                  <span className="text-muted-foreground">
                    {alsoDeleteTx ? "History will be permanently erased." : "Otherwise history stays, just detached."}
                  </span>
                </span>
              </label>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setDeleteTarget(null)}
                  className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                  Cancel
                </button>
                <button onClick={() => { deleteAccount({ id: deleteTarget.id, alsoDeleteTransactions: alsoDeleteTx }); setDeleteTarget(null); }}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-red-500/25 transition-all">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </TransactionModalOverlay>
      )}

      {/* Loan payment modal — backend splits interest vs principal */}
      {payLoan && (() => {
        const amt         = parseFloat(payAmount) || 0;
        const outstanding = Math.max(0, payLoan.currentBalance);
        const estInterest = payLoan.apr ? Math.min(amt, Math.round(outstanding * payLoan.apr / 12) / 100) : 0;
        const payFromOptions = accounts
          .filter(a => a.accountType === "BANK_ACCOUNT" || a.accountType === "CASH_WALLET" || a.accountType === "EMERGENCY_FUND")
          .map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));
        return (
          <TransactionModalOverlay onDismiss={() => setPayLoan(null)}>
            <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
              <div className="h-1.5 bg-gradient-to-r from-rose-400 to-red-500" />
              <div className="p-5">
                <FormModalHeader icon={HandCoins} tone="red" title="Record Loan Payment" onClose={() => setPayLoan(null)} />
                <p className="text-xs text-muted-foreground -mt-3 mb-4 truncate">{payLoan.name} — {fmt(outstanding)} outstanding</p>

                <BigAmountInput colorClass="text-rose-500 dark:text-rose-400"
                  inputProps={{
                    value: payAmount,
                    onChange: e => setPayAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
                    placeholder: payLoan.emiAmount ? String(payLoan.emiAmount) : "0",
                  }} />

                <div className="mt-4 space-y-3">
                  <FormSelect label="Paid from" options={payFromOptions} placeholder="Untracked source (cash outside app)"
                    value={payFrom} onChange={e => setPayFrom(e.target.value)} />
                </div>

                {amt > 0 && payLoan.apr != null && payLoan.apr > 0 && (
                  <div className="bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground mt-4 space-y-1">
                    <div className="flex justify-between"><span>Interest (this month, est.)</span><span className="tabular-nums">{fmt(estInterest)}</span></div>
                    <div className="flex justify-between font-medium text-foreground"><span>Reduces loan by (est.)</span><span className="tabular-nums">{fmt(Math.min(Math.max(0, amt - estInterest), outstanding))}</span></div>
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button disabled={payingLoan || amt <= 0}
                    onClick={() => recordLoanPayment(
                      { id: payLoan.id, amount: amt, fromAccountId: payFrom || undefined },
                      { onSuccess: () => setPayLoan(null) })}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-rose-500/25 transition-all disabled:opacity-60 disabled:shadow-none">
                    {payingLoan ? "Recording…" : "Record Payment"}
                  </button>
                  <button onClick={() => setPayLoan(null)}
                    className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </TransactionModalOverlay>
        );
      })()}

      {/* ── Create/Edit Account modal — its own bespoke chrome (unlike Income/Expense/Transfer
          below, which now use the same shared form components as the rest of the app). ── */}
      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 lg:left-60 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={close}>
          {/* Same rounded-3xl / gradient-bar / p-5 chrome as ExpenseForm and the other shared
              transaction forms, so creating/editing an account matches the rest of the app. */}
          <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="h-1.5" style={{ background: `linear-gradient(to right, ${ACCOUNT_TYPE_META[activeType].hex}, ${ACCOUNT_TYPE_META[activeType].hex}99)` }} />
            <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <PremiumIcon icon={ACCOUNT_TYPE_META[activeType].icon} hex={ACCOUNT_TYPE_META[activeType].hex} size="md" className="w-10 h-10" />
                  <h3 className="font-semibold text-foreground text-base flex-1 truncate">
                    {modal === "edit"
                      ? (isCCForm ? "Edit Card" : "Edit Account")
                      : "New Account"}
                  </h3>
                  {modal === "edit" && editAccount && (
                    <div className="relative group shrink-0">
                      <button type="button" onClick={() => {
                          const label = editAccount.accountType === "LOAN" ? "Archive Loan" : "Archive Account";
                          askConfirm(label, `Archive "${editAccount.name}"? It will be hidden from all views but all history is preserved.`,
                            () => archiveAccount(editAccount.id));
                          close();
                        }}
                        aria-label="Archive"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-amber-500 hover:bg-amber-500/10 transition-all">
                        <Archive className="w-4 h-4" />
                      </button>
                      <span className="pointer-events-none absolute top-full right-0 mt-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background opacity-0 translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 z-10">
                        Archive
                      </span>
                    </div>
                  )}
                  <button type="button" onClick={close} aria-label="Close"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={createForm.handleSubmit(modal === "edit" ? onEditSubmit : onCreateSubmit)} className="space-y-4">
                  {modal === "create" && (
                    <div className="grid grid-cols-3 gap-2">
                      {(["CASH_WALLET","BANK_ACCOUNT","EMERGENCY_FUND","CREDIT_CARD","LOAN","INVESTMENT"] as AccountType[]).map(t => {
                        const m = ACCOUNT_TYPE_META[t];
                        const Icon = m.icon;
                        const singleton    = t === "CASH_WALLET" || t === "EMERGENCY_FUND";
                        const alreadyExists = singleton && accounts.some(a => a.accountType === t);
                        const selected = watchedType === t && !alreadyExists;
                        return (
                          <button key={t} type="button" disabled={alreadyExists}
                            onClick={() => {
                              // Full reset (not setValue) — clears every type-specific field
                              // (apr, creditLimit, loanType, etc.) left over from whichever type
                              // was selected before, so it can't silently ride along on submit.
                              createForm.reset({
                                accountType: t,
                                name: t === "CASH_WALLET" ? "Cash Wallet" : t === "EMERGENCY_FUND" ? "Emergency Fund"
                                  : t === "INVESTMENT" ? "Investment Account" : t === "CREDIT_CARD" ? "Credit Card" : t === "LOAN" ? "Loan" : "",
                                openingBalance: createForm.getValues("openingBalance"),
                              });
                              setBankInput("");
                            }}
                            style={selected ? { backgroundColor: m.hex + "14", borderColor: m.hex } : undefined}
                            className={cn("flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-[11px] font-semibold transition-all",
                              alreadyExists ? "opacity-40 cursor-not-allowed bg-muted border-border text-muted-foreground"
                                : selected ? "shadow-sm" : "border-border bg-muted/40 text-muted-foreground hover:border-border/80 hover:bg-muted/70")}>
                            {alreadyExists
                              ? <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"><Icon className="w-4 h-4" strokeWidth={1.75} /></div>
                              : <PremiumIcon icon={Icon} hex={m.hex} size="xs" className="w-8 h-8" />}
                            <span style={selected ? { color: m.hex } : undefined}>{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(isCCForm || isBankForm || isLoanForm || isInvForm) && (
                    <BankNameInput
                      label={isCCForm ? "Card Issuer (Bank)" : isLoanForm ? "Lender (Bank / NBFC)" : isInvForm ? "Broker / Platform" : "Bank Name"}
                      suggestions={isInvForm ? STOCK_BROKERS : INDIAN_BANKS}
                      value={bankInput}
                      onChange={v => { setBankInput(v);
                        if (isBankForm) createForm.setValue("name", v || "Bank Account");
                        if (isInvForm)  createForm.setValue("name", v || "Investment Account");
                        if (isCCForm)   createForm.setValue("name", v ? `${v} Card` : "");
                        if (isLoanForm) {
                          const label = LOAN_TYPE_LABELS[createForm.getValues("loanType") ?? ""];
                          createForm.setValue("name", label ? `${v} ${label}`.trim() : (v || "Loan"));
                        } }} />
                  )}

                  {isLoanForm && (
                    <FormSelect label="Loan Type" options={LOAN_TYPE_OPTIONS} placeholder="Select loan type"
                      error={createForm.formState.errors.loanType?.message}
                      value={createForm.watch("loanType") ?? ""}
                      onChange={e => {
                        const v = e.target.value as CreateAccountForm["loanType"];
                        createForm.setValue("loanType", v);
                        const label = LOAN_TYPE_LABELS[v ?? ""];
                        createForm.setValue("name", label ? `${bankInput} ${label}`.trim() : (bankInput || "Loan"));
                      }} />
                  )}

                  {/* Name — only Cash Wallet / Emergency Fund keep a free-text name, and only on
                      edit. Every other type is auto-named from its bank/broker (+ loan type),
                      matching what the card actually displays, so there's nothing to duplicate. */}
                  {isSimpleType && modal === "edit" && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Account Name</label>
                      <input {...createForm.register("name")}
                        placeholder="e.g. HDFC Savings"
                        className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                      {createForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.name.message}</p>}
                    </div>
                  )}

                  {isCCForm && (
                    /* Card number + limit on same row for credit cards */
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                          Last 4 digits <span className="text-muted-foreground/60">(optional)</span>
                        </label>
                        <input {...createForm.register("accountNumber")} placeholder="e.g. 4567" maxLength={4}
                          className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Credit Limit</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">{currSymbol}</span>
                          <input type="text" inputMode="decimal" placeholder="e.g. 100000" {...creditLimitField}
                            onChange={e => { e.target.value = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); creditLimitField.onChange(e); }}
                            className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  )}

                  {isBankForm && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                        Account Number <span className="text-muted-foreground/60">(last 4 digits, optional)</span>
                      </label>
                      <input {...createForm.register("accountNumber")} placeholder="e.g. 4567"
                        className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                    </div>
                  )}

                  {/* Balance: opening balance on create; reconcile-against-actual on edit — editing
                      the balance and the account's other details happen in one Save, instead of a
                      separate "Adjust Balance" flow. */}
                  {modal === "create" ? (
                    <BigAmountInput
                      label={isCCForm || isLoanForm ? "Current Outstanding Balance" : "Opening Balance"}
                      colorClass="text-foreground"
                      inputProps={createForm.register("openingBalance")}
                      error={createForm.formState.errors.openingBalance?.message} />
                  ) : (
                    <div className="space-y-2">
                      <BigAmountInput
                        label={isCCForm || isLoanForm ? "Actual Outstanding" : "Actual Balance"}
                        colorClass="text-foreground"
                        inputProps={{
                          value: actualBalance,
                          onChange: e => setActualBalance(e.target.value),
                        }} />
                      <p className="text-[11px] text-muted-foreground/70 text-center">
                        Prefilled from the app — change it to match your {isCCForm || isLoanForm ? "statement" : "bank"} if they&apos;ve drifted apart.
                      </p>
                      {actualBalance !== "" && !isNaN(editBalanceTarget) && editBalanceDiff !== 0 && (
                        <div className={cn("rounded-xl px-3 py-2 text-sm flex items-center justify-between",
                          editBalanceGoodDirection ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400")}>
                          <span>{editBalanceAdjustLabel}</span>
                          <span className="font-semibold tabular-nums">{editBalanceIsPositive ? "+" : "−"}{formatCurrency(Math.abs(editBalanceDiff))}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!isCCForm && !isLoanForm && (
                    <FormCurrencyInput label="Low Balance Alert (optional)"
                      placeholder="e.g. 1000 — get notified below this"
                      {...createForm.register("lowBalanceThreshold")}
                      error={createForm.formState.errors.lowBalanceThreshold?.message} />
                  )}

                  {isCCForm && (
                    <>
                      <button type="button" onClick={() => setShowCCDetails(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors w-fit">
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCCDetails && "rotate-180")} />
                        {showCCDetails ? "Hide billing cycle" : "Set billing cycle (statement & due dates)"}
                      </button>
                      {showCCDetails && (
                        <div className="space-y-3 pl-3 border-l-2 border-indigo-500/20">
                          <p className="text-[11px] text-muted-foreground/80">
                            Used to calculate your next statement date and payment due date.
                          </p>
                          <div className="grid grid-cols-2 gap-3 items-end">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Statement Day</label>
                              <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                              <input type="number" min={1} max={28} placeholder="e.g. 15"
                                {...createForm.register("statementDay")}
                                className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                                  createForm.formState.errors.statementDay ? "border-red-500/60" : "border-border")} />
                              {createForm.formState.errors.statementDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.statementDay.message}</p>}
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Due Day</label>
                              <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                              <input type="number" min={1} max={28} placeholder="e.g. 5"
                                {...createForm.register("paymentDueDay")}
                                className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                                  createForm.formState.errors.paymentDueDay ? "border-red-500/60" : "border-border")} />
                              {createForm.formState.errors.paymentDueDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.paymentDueDay.message}</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isLoanForm && (
                    <div className="space-y-3 pl-3 border-l-2 border-rose-500/20">
                      <div className="grid grid-cols-2 gap-3">
                        <FormCurrencyInput label="Original Loan Amount" placeholder="Defaults to outstanding"
                          {...createForm.register("principalAmount")}
                          error={createForm.formState.errors.principalAmount?.message} />
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                            Interest Rate (% p.a.) <span className="text-muted-foreground/60">(optional)</span>
                          </label>
                          <input type="number" step="0.01" min={0} max={100} placeholder="e.g. 8.5"
                            {...createForm.register("apr")}
                            className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                              createForm.formState.errors.apr ? "border-red-500/60" : "border-border")} />
                          {createForm.formState.errors.apr && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.apr.message}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormCurrencyInput label="EMI Amount" placeholder="e.g. 25000"
                          {...createForm.register("emiAmount")}
                          error={createForm.formState.errors.emiAmount?.message} />
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5 font-medium">EMI Day (1–28) <span className="text-muted-foreground/60">(optional)</span></label>
                          <input type="number" min={1} max={28} placeholder="e.g. 5"
                            {...createForm.register("emiDay")}
                            className={cn("w-full h-10 px-3 rounded-xl text-sm bg-background border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all",
                              createForm.formState.errors.emiDay ? "border-red-500/60" : "border-border")} />
                          {createForm.formState.errors.emiDay && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.emiDay.message}</p>}
                        </div>
                      </div>
                      <Controller control={createForm.control} name="autopayAccountId" render={({ field }) => (
                        <AccountPicker label="Auto-pay EMI from (optional)" placeholder="Manual payments only" allowClear
                          cashAccounts={accounts.filter(a => a.accountType === "CASH_WALLET" && !a.archived)}
                          bankAccounts={accounts.filter(a => a.accountType === "BANK_ACCOUNT" && !a.archived)}
                          emergencyFundAccounts={accounts.filter(a => a.accountType === "EMERGENCY_FUND" && !a.archived)}
                          creditAccounts={[]}
                          value={field.value ?? ""} onChange={field.onChange} />
                      )} />
                      <p className="text-[11px] text-muted-foreground/80">
                        With auto-pay, the EMI is debited monthly on the EMI day — interest is logged as an
                        expense and the principal reduces your outstanding automatically.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={creating || updating || adjusting}
                      className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
                      {creating || updating || adjusting ? "Saving…" : modal === "edit" ? "Save Changes" : "Create Account"}
                    </button>
                    <button type="button" onClick={close}
                      className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Income / Add Expense / Transfer — same shared components used on the
          Transactions page and Home (AccountPicker, CategoryPicker, BigAmountInput, built-in
          balance validation), instead of a second, plainer set of forms duplicated here. ── */}
      {modal === "addMoney" && (
        <TransactionModalOverlay onDismiss={close}>
          <IncomeForm onSubmit={handleAddIncome} onCancel={close} isPending={addingMoney}
            accounts={accounts} incomeCategories={incomeCategories}
            defaultValues={preAccount ? { accountId: preAccount.id } : undefined}
            defaultSource={defaultIncomeSource} sourceUsageCounts={incomeSourceUsage}
            showRecurringOption />
        </TransactionModalOverlay>
      )}

      {modal === "addExpense" && (
        <TransactionModalOverlay onDismiss={close}>
          <ExpenseForm title="Add Expense" categoryOptions={categoryOptions}
            cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={creditCards}
            lockedAccount={lockedExpenseAccount ?? undefined}
            defaultCategoryId={defaultExpenseCategoryId}
            onSubmit={handleAddExpense} onCancel={close} isPending={addingExpense} submitLabel="Add Expense" />
        </TransactionModalOverlay>
      )}

      {modal === "import" && (
        <ImportStatementModal onClose={close}
          bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          initialAccountId={preAccount?.id} />
      )}

      {modal === "transfer" && (
        <TransactionModalOverlay onDismiss={close}>
          <TransferFormModal onSubmit={handleAddTransfer} onCancel={close} isPending={transferring}
            accounts={accounts}
            title={preAccount?.accountType === "CREDIT_CARD" ? "Pay Credit Card Bill" : "Transfer Between Accounts"}
            submitLabel={preAccount?.accountType === "CREDIT_CARD" ? "Pay Bill" : "Transfer"}
            defaultFromAccountId={payBillMode ? undefined : preAccount?.id}
            defaultToAccountId={payBillMode ? preAccount?.id : undefined} />
        </TransactionModalOverlay>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Stat strip — one uniform card per type the user actually has (same size/shape as the
            type breakdowns below), so someone with just a bank account and a credit card sees
            2 cards, not 6 padded out with empty types they haven't set up. */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 animate-fade-in-up">
            <div className="bg-primary/8 border border-primary/15 rounded-2xl p-4">
              <PremiumIcon icon={Wallet} tone="blue" size="xs" className="mb-2" />
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Total Balance</p>
              <p className="text-base font-bold tabular-nums text-foreground">{fmt(totalAssetsAcrossAccounts)}</p>
              <p className="text-[10px] text-muted-foreground/50">Cash, bank &amp; investments</p>
            </div>

            {bankAccounts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <PremiumIcon icon={Landmark} hex={ACCOUNT_TYPE_META.BANK_ACCOUNT.hex} size="xs" className="mb-2" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Bank</p>
                <p className="text-base font-bold tabular-nums text-foreground">{fmt(bankBalance)}</p>
                <p className="text-[10px] text-muted-foreground/50">{bankAccounts.length} account{bankAccounts.length === 1 ? "" : "s"}</p>
              </div>
            )}

            {/* Cash + Emergency Fund are two differently-colored concepts everywhere else in the app
                (emerald / amber) — this card is a composite of both, so it deliberately stays neutral
                rather than claiming either color. */}
            {(cashAccounts.length + emergencyAccounts.length) > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <PremiumIcon icon={Wallet} tone="gray" size="xs" className="mb-2" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Cash &amp; Emergency</p>
                <p className="text-base font-bold tabular-nums text-foreground">{fmt(cashBalance + emergencyBal)}</p>
                <p className="text-[10px] text-muted-foreground/50">{cashAccounts.length + emergencyAccounts.length} account{(cashAccounts.length + emergencyAccounts.length) === 1 ? "" : "s"}</p>
              </div>
            )}

            {/* Assets end here, liabilities (Credit Cards, Loans) follow — kept grouped so the strip
                reads assets-then-liabilities left to right. */}
            {investAccounts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <PremiumIcon icon={TrendingUp} hex={ACCOUNT_TYPE_META.INVESTMENT.hex} size="xs" className="mb-2" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Investments</p>
                <p className="text-base font-bold tabular-nums text-foreground">{fmt(investBalance)}</p>
                <p className="text-[10px] text-muted-foreground/50">{investAccounts.length} broker{investAccounts.length === 1 ? "" : "s"}</p>
              </div>
            )}

            {creditCards.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <PremiumIcon icon={CreditCard} hex={ACCOUNT_TYPE_META.CREDIT_CARD.hex} size="xs" className="mb-2" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Credit Cards</p>
                <p className="text-base font-bold tabular-nums text-foreground">{fmt(creditCardDebt)}</p>
                <p className={cn("text-[10px]", creditCardDebt > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/50")}>
                  {creditCards.length} card{creditCards.length === 1 ? "" : "s"}{creditCardDebt > 0 ? " · dues" : ""}
                </p>
              </div>
            )}

            {loanAccounts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <PremiumIcon icon={HandCoins} hex={ACCOUNT_TYPE_META.LOAN.hex} size="xs" className="mb-2" />
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Loans</p>
                <p className="text-base font-bold tabular-nums text-foreground">{fmt(loanDebt)}</p>
                <p className={cn("text-[10px]", loanDebt > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/50")}>
                  {loanAccounts.length} active
                </p>
              </div>
            )}
          </div>
        )}

        {/* Filter tabs — same template as the Investments page's tab bar: solid-fill pills
            colored per account type (matching ACCOUNT_TYPE_META), with a count badge,
            horizontally scrollable with a hidden scrollbar. */}
        {accounts.length > 0 && (
          <div className="flex gap-1 overflow-x-auto animate-fade-in-up" style={{ scrollbarWidth: "none" }}>
            {([
              { key: "all",    label: "All",              icon: LayoutGrid, count: accounts.length },
              { key: "bank",   label: "Bank",              icon: Landmark,   count: bankAccounts.length },
              { key: "cash",   label: "Cash & Emergency",  icon: Wallet,     count: cashAccounts.length + emergencyAccounts.length },
              { key: "invest", label: "Investments",       icon: TrendingUp, count: investAccounts.length },
              { key: "cc",     label: "Credit Cards",      icon: CreditCard, count: creditCards.length },
              { key: "loan",   label: "Loans",             icon: HandCoins,  count: loanAccounts.length },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setSectionFilter(t.key)}
                className={cn(
                  "flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                  sectionFilter === t.key ? cn(SECTION_ACTIVE_BG[t.key], "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {t.key !== "all" && t.count > 0 && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
                    sectionFilter === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="No accounts yet"
            description="Set up your Bank Account, Cash Wallet, Credit Card, Loan, or Investment Account."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                {(["BANK_ACCOUNT","CASH_WALLET","EMERGENCY_FUND","CREDIT_CARD","LOAN","INVESTMENT"] as AccountType[]).map(t => {
                  const m = ACCOUNT_TYPE_META[t];
                  return (
                    <button key={t} onClick={() => openCreate(t)}
                      className="flex items-center gap-2 h-9 pl-2 pr-4 rounded-xl text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all">
                      <PremiumIcon icon={m.icon} hex={m.hex} size="xs" /> {m.label}
                    </button>
                  );
                })}
              </div>
            } />
        ) : sectionFilter === "all" ? (
          // Unified view: every account, one continuous grid, ordered Bank → Cash & Emergency →
          // Investments → Credit Cards → Loans — a lone Bank account and a lone Cash Wallet land
          // in the same row instead of each sitting alone in its own full-width section.
          <div className="grid gap-4 lg:grid-cols-2 animate-fade-in-up">
            {allAccountsOrdered.map(a => renderAccountCard(a))}
            {allAccountsOrdered.length % 2 === 1 && (
              <AddMoreCard label="Account" type="BANK_ACCOUNT" onClick={() => openCreate("BANK_ACCOUNT")} />
            )}
          </div>
        ) : (
          <>
            {/* Bank Accounts */}
            {sectionFilter === "bank" && (
            <section className="animate-fade-in-up delay-150">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PremiumIcon icon={Landmark} hex={ACCOUNT_TYPE_META.BANK_ACCOUNT.hex} size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Bank Accounts</h2>
                </div>
                <button onClick={() => openCreate("BANK_ACCOUNT")}
                  className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Bank
                </button>
              </div>
              {bankAccounts.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {bankAccounts.map(a => renderAccountCard(a))}
                  {bankAccounts.length % 2 === 1 && (
                    <AddMoreCard label="Bank Account" type="BANK_ACCOUNT" onClick={() => openCreate("BANK_ACCOUNT")} />
                  )}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No bank accounts added</p>
                  <button onClick={() => openCreate("BANK_ACCOUNT")} className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">+ Add Bank Account</button>
                </div>
              )}
            </section>
            )}

            {/* Cash & Emergency */}
            {sectionFilter === "cash" && (
            <section className="animate-fade-in-up delay-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PremiumIcon icon={Wallet} hex={ACCOUNT_TYPE_META.CASH_WALLET.hex} size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Cash &amp; Emergency</h2>
                </div>
                <div className="flex items-center gap-3">
                  {cashAccounts.length === 0 && (
                    <button onClick={() => openCreate("CASH_WALLET")} className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Cash Wallet
                    </button>
                  )}
                  {emergencyAccounts.length === 0 && (
                    <button onClick={() => openCreate("EMERGENCY_FUND")} className="text-xs text-amber-500 dark:text-amber-400 hover:underline flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Emergency Fund
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {cashAccounts.length > 0
                  ? cashAccounts.map(a => renderAccountCard(a))
                  : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                      <p className="text-sm text-muted-foreground">No cash wallet</p>
                      <button onClick={() => openCreate("CASH_WALLET")} className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 hover:underline transition-colors">+ Set up</button>
                    </div>
                }
                {emergencyAccounts.length > 0
                  ? emergencyAccounts.map(a => renderAccountCard(a))
                  : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                      <p className="text-sm text-muted-foreground">No emergency fund</p>
                      <button onClick={() => openCreate("EMERGENCY_FUND")} className="mt-2 text-xs text-amber-500 dark:text-amber-400 hover:underline transition-colors">+ Set up</button>
                    </div>
                }
              </div>
            </section>
            )}

            {/* Investment Accounts (broker cash) — grouped with the other assets, before the liabilities */}
            {sectionFilter === "invest" && (
            <section className="animate-fade-in-up delay-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PremiumIcon icon={TrendingUp} hex={ACCOUNT_TYPE_META.INVESTMENT.hex} size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Investment Accounts</h2>
                </div>
                <button onClick={() => openCreate("INVESTMENT")}
                  className="text-xs text-sky-500 dark:text-sky-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Account
                </button>
              </div>
              {investAccounts.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {investAccounts.map(a => renderAccountCard(a))}
                  {investAccounts.length % 2 === 1 && (
                    <AddMoreCard label="Investment Account" type="INVESTMENT" onClick={() => openCreate("INVESTMENT")} />
                  )}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No investment accounts</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Track cash parked with your broker (Zerodha, Groww…) and buy investments from it.</p>
                  <button onClick={() => openCreate("INVESTMENT")} className="mt-2 text-xs text-sky-500 dark:text-sky-400 hover:underline transition-colors">+ Add Investment Account</button>
                </div>
              )}
            </section>
            )}

            {/* Credit Cards */}
            {sectionFilter === "cc" && (
            <section className="animate-fade-in-up delay-375">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PremiumIcon icon={CreditCard} hex={ACCOUNT_TYPE_META.CREDIT_CARD.hex} size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Credit Cards</h2>
                </div>
                <button onClick={() => openCreate("CREDIT_CARD")}
                  className="text-xs text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Card
                </button>
              </div>
              {creditCards.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {creditCards.map(a => renderAccountCard(a))}
                  {creditCards.length % 2 === 1 && (
                    <AddMoreCard label="Credit Card" type="CREDIT_CARD" onClick={() => openCreate("CREDIT_CARD")} />
                  )}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No credit cards added</p>
                  <button onClick={() => openCreate("CREDIT_CARD")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Credit Card</button>
                </div>
              )}
            </section>
            )}

            {/* Loans */}
            {sectionFilter === "loan" && (
            <section className="animate-fade-in-up delay-450">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PremiumIcon icon={HandCoins} hex={ACCOUNT_TYPE_META.LOAN.hex} size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Loans</h2>
                </div>
                <button onClick={() => openCreate("LOAN")}
                  className="text-xs text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Loan
                </button>
              </div>
              {loanAccounts.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {loanAccounts.map(a => renderAccountCard(a))}
                  {loanAccounts.length % 2 === 1 && (
                    <AddMoreCard label="Loan" type="LOAN" onClick={() => openCreate("LOAN")} />
                  )}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No loans tracked</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Track EMIs and see loans reflected in your net worth automatically.</p>
                  <button onClick={() => openCreate("LOAN")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Loan</button>
                </div>
              )}
            </section>
            )}

          </>
        )}

        {/* ── Archived Accounts ── */}
        {filteredArchived.length > 0 && (
          <section className="mt-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="font-medium">Archived Accounts ({filteredArchived.length})</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showArchived && "rotate-180")} />
            </button>

            {showArchived && (
              <div className="space-y-3">
                {filteredArchived.map(a => {
                  const meta = ACCOUNT_TYPE_META[a.accountType as AccountType] ?? ACCOUNT_TYPE_META.BANK_ACCOUNT;
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                      <BankLogo name={a.bankName} fallbackIcon={meta.icon} fallbackHex={meta.hex} size="sm" className="w-9 h-9" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.label}{a.bankName ? ` · ${a.bankName}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => askConfirm(
                            "Restore Account",
                            `Restore "${a.name}"? It will appear in your active accounts again.`,
                            () => unarchiveAccount(a.id)
                          )}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(a); setAlsoDeleteTx(false); }}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Wallet, label: "Add Account", color: "indigo", onClick: () => openCreate("BANK_ACCOUNT") },
      ]} />
    </div>
  );
}
