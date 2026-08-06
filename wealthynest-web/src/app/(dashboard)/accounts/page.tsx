"use client";

import {useMemo, useState} from "react";
import dynamic from "next/dynamic";
import {Wallet} from "lucide-react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {type IncomeFormValues, type IncomeSourceValue} from "@/components/transactions/IncomeForm";
import {type TransferFormValues} from "@/components/transactions/TransferFormModal";
import type {ExpenseFormValues} from "@/features/expenses/schemas/expense.schema";
import {
    useAccounts,
    useAdjustBalance,
    useArchiveAccount,
    useArchivedAccounts,
    useCloseAccount,
    useCreateAccount,
    useDeleteAccount,
    useRecordLoanPayment,
    useSetPrimaryAccount,
    useTransfer,
    useUnarchiveAccount,
    useUpdateAccount,
} from "@/features/accounts/hooks/useAccounts";
import {CURRENCIES, usePrefsStore} from "@/store/preferences.store";
import {AccountCard} from "@/features/accounts/components/AccountCard";
import {LoanCard} from "@/features/accounts/components/LoanCard";
import {
    type CreateAccountForm,
    createAccountSchema,
    LOAN_TYPE_LABELS,
} from "@/features/accounts/schemas/account.schema";
import {useAllTimeExpenses, useCreateExpense, useExpenses} from "@/features/expenses/hooks/useExpenses";
import {useCreateIncome, useIncome} from "@/features/income/hooks/useIncome";
import {useDebts} from "@/features/debts/hooks/useDebts";
import type {DebtRecord} from "@/features/debts/types/debt.types";
import {useCategories} from "@/features/categories/hooks/useCategories";
import {useCreateRecurringIncome} from "@/features/recurringIncome/hooks/useRecurringIncome";
import {buildUsageCounts, pickSmartDefault} from "@/lib/mostUsed";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useTabParam} from "@/hooks/useTabParam";
import {AccountStatStrip} from "./_components/AccountStatStrip";
import {AccountFilterTabs} from "./_components/AccountFilterTabs";
import {AccountsGrid} from "./_components/AccountsGrid";
import {ArchivedAccountsSection} from "./_components/ArchivedAccountsSection";
import {ClosedAccountsSection} from "./_components/ClosedAccountsSection";

// Lazy-loaded: all four are only ever needed after a user opens one of them, never on first
// paint — keeping them out of the page's initial bundle shrinks it noticeably, since together
// they're most of this page's form/modal code.
const DeleteAccountModal = dynamic(
  () => import("./_components/DeleteAccountModal").then(m => m.DeleteAccountModal), { ssr: false }
);
const LoanPaymentModal = dynamic(
  () => import("./_components/LoanPaymentModal").then(m => m.LoanPaymentModal), { ssr: false }
);
const AccountFormModal = dynamic(
  () => import("./_components/AccountFormModal").then(m => m.AccountFormModal), { ssr: false }
);
const AccountTransactionModals = dynamic(
  () => import("./_components/AccountTransactionModals").then(m => m.AccountTransactionModals), { ssr: false }
);

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalType = "none" | "create" | "addMoney" | "addExpense" | "transfer" | "edit" | "import";
type ConfirmState = { title: string; message: string; onConfirm: () => void } | null;

const SECTION_FILTERS = ["all", "bank", "cash", "cc", "loan"] as const;

// Module-scope, not a per-render literal — AccountCard's linkedDebts needs the exact same array
// reference every time an account genuinely has none, or the memoized card re-renders anyway.
const NO_DEBTS: DebtRecord[] = [];

export default function AccountsPage() {
  const { fmt } = useAmountFormatter();
  const now = new Date();
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";
  const [modal, setModal]              = useState<ModalType>("none");
  const [sectionFilter, setSectionFilter] = useTabParam(SECTION_FILTERS, "all");
  const [bankInput, setBankInput]      = useState("");
  const [editAccount, setEditAccount]  = useState<WalletAccount | null>(null);
  const [preAccount, setPreAccount]    = useState<WalletAccount | null>(null);
  const [showCCDetails, setShowCCDetails] = useState(false);
  const [confirm, setConfirm]          = useState<ConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<WalletAccount | null>(null);

  const [showArchived, setShowArchived]      = useState(false);
  const [showClosed, setShowClosed]          = useState(false);
  const { data: accounts = [], isLoading, isError, refetch }   = useAccounts();
  const { data: archivedAccounts = [] }      = useArchivedAccounts();
  const { data: allDebts  = [] }           = useDebts();
  const { data: categories = [] }          = useCategories("EXPENSE");
  const { data: incomeCategories = [] }    = useCategories("INCOME");

  // Grouped once per allDebts change, not re-filtered per account on every render — the memoized
  // AccountCard below only actually skips re-rendering if linkedDebts keeps the same array
  // reference when nothing relevant changed, which a fresh .filter() per render can't give it.
  const debtsByAccountId = useMemo(() => {
    const map = new Map<string, typeof allDebts>();
    for (const d of allDebts) {
      if (!d.accountId) continue;
      const list = map.get(d.accountId);
      if (list) list.push(d); else map.set(d.accountId, [d]);
    }
    return map;
  }, [allDebts]);

  // Same "last used, else most used" default as the Transactions page's Add Expense/Income —
  // reused via pickSmartDefault so opening these forms from an account card doesn't drop back to
  // an empty category picker just because it's a different entry point into the same forms.
  const { data: allTimeExpensesData }      = useAllTimeExpenses();
  const allTimeExpenses = useMemo(() => allTimeExpensesData ?? [], [allTimeExpensesData]);
  const { data: allTimeIncome = [] }       = useIncome(undefined, undefined, true);
  const defaultExpenseCategoryId = useMemo(() =>
    pickSmartDefault(allTimeExpenses, e => e.expenseDate, e => e.createdAt, e => e.categoryId),
    [allTimeExpenses]);
  const defaultIncomeSource = useMemo((): IncomeSourceValue =>
    (pickSmartDefault(allTimeIncome, i => i.incomeDate, i => i.createdAt, i => i.source) as IncomeSourceValue) ?? "SALARY",
    [allTimeIncome]);
  const incomeSourceUsage = useMemo(() => buildUsageCounts(allTimeIncome, i => i.source), [allTimeIncome]);

  const [payLoan, setPayLoan] = useState<WalletAccount | null>(null);
  // Balance reconciliation, folded into the Edit form itself rather than a separate modal —
  // initialized from editAccount.currentBalance when the edit form opens (see openEdit below).
  const [actualBalance, setActualBalance] = useState("");

  const { mutate: createAccount, isPending: creating }        = useCreateAccount();
  const { mutate: updateAccount, isPending: updating }        = useUpdateAccount();
  const { mutate: doAdjustBalance, isPending: adjusting }     = useAdjustBalance();
  const { mutate: deleteAccount }                             = useDeleteAccount();
  const { mutate: archiveAccount }                            = useArchiveAccount();
  const { mutate: unarchiveAccount }                          = useUnarchiveAccount();
  const { mutate: closeAccountMutation }                      = useCloseAccount();
  const { mutate: setPrimaryAccount, isPending: settingPrimary } = useSetPrimaryAccount();
  const { mutate: doTransfer, isPending: transferring }       = useTransfer();
  const { mutate: recordLoanPayment, isPending: payingLoan }  = useRecordLoanPayment();
  const { mutate: createIncome, isPending: addingMoney }      = useCreateIncome();
  const { mutate: createRecurringIncome }                     = useCreateRecurringIncome();
  const { mutate: createExpense, isPending: addingExpense }   = useCreateExpense();

  // openingBalance starts undefined (not 0) so the field renders genuinely blank on a new
  // account — react-hook-form's DefaultValues<T> allows this per-field regardless of the
  // schema's own (non-optional) output type; zodResolver still rejects a submit that never
  // fills it in, same as every other required field here.
  const createForm = useForm<CreateAccountForm>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { accountType: "CASH_WALLET", name: "Cash Wallet", openingBalance: undefined },
  });

  // getAccounts() returns both ACTIVE and CLOSED rows (a closed account still needs to resolve
  // in historical contexts) — CLOSED behaves like Archived on this page: pulled out of the main
  // grid/totals/tabs into its own collapsed section below, not mixed in with the accounts you can
  // still act on. Purpose (Emergency Fund, etc.) is just a tag on a Bank Account now, not a
  // separate type — a purpose-tagged account already lands in bankAccounts naturally. Same for
  // what used to be a distinct "Investment Account" type (broker cash float is a purpose-tagged
  // bank account too).
  const activeAccounts = accounts.filter(a => a.status === "ACTIVE");
  const closedAccounts = accounts.filter(a => a.status === "CLOSED");
  const cashAccounts = activeAccounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts = activeAccounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const creditCards  = activeAccounts.filter(a => a.accountType === "CREDIT_CARD");
  const loanAccounts = activeAccounts.filter(a => a.accountType === "LOAN");

  const SECTION_TYPES: Record<Exclude<typeof sectionFilter, "all">, AccountType[]> = {
    bank: ["BANK_ACCOUNT"], cash: ["CASH_WALLET"], cc: ["CREDIT_CARD"], loan: ["LOAN"],
  };
  const filteredArchived = sectionFilter === "all"
    ? archivedAccounts
    : archivedAccounts.filter(a => SECTION_TYPES[sectionFilter].includes(a.accountType));
  const filteredClosed = sectionFilter === "all"
    ? closedAccounts
    : closedAccounts.filter(a => SECTION_TYPES[sectionFilter].includes(a.accountType));

  const totalBalance   = [...cashAccounts, ...bankAccounts].reduce((s, a) => s + a.currentBalance, 0);
  const bankBalance    = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const cashBalance    = cashAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const creditCardDebt = creditCards.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);
  const loanDebt       = loanAccounts.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);

  // Total balance = everything you own outright (cash + bank, purpose-tagged or not) — matches
  // the dashboard's own "Total Balance" widget; credit cards and loans are liabilities, already
  // broken out in their own stat cards below, so they're not netted in here.
  const totalAssetsAcrossAccounts = totalBalance;

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));

  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirm({ title, message, onConfirm });

  const openCreate = (type: AccountType) => {
    setBankInput("");
    setShowCCDetails(false);
    createForm.reset({
      accountType: type, openingBalance: undefined,
      // Every type needs a non-blank default — Bank Account has no dedicated Name field of its
      // own (it's derived from the bank name once typed), so leaving this "" let a completely
      // untouched submit fail schema validation with nowhere on screen to show why: BankNameInput
      // has no error slot, so the blocked submit looked like a dead button. Matches the same
      // fallback BankNameInput's own onChange already applies once the user *does* type.
      name: type === "CASH_WALLET" ? "Cash Wallet" : type === "CREDIT_CARD" ? "Credit Card" : type === "LOAN" ? "Loan" : "Bank Account",
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
      // Purpose was missing here entirely — every edit open silently started from "no purpose"
      // regardless of what the account actually had, so the picker never showed the real value
      // and (once the backend's null-means-unchanged guard on this field is fixed) submitting
      // without touching Purpose would have wiped it on every edit.
      purpose: account.purpose ?? undefined, purposeLabel: account.purposeLabel ?? undefined,
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

  // Types whose form collects a bank / lender name via BankNameInput
  const usesBankInput = (t: AccountType) =>
    t === "BANK_ACCOUNT" || t === "CREDIT_CARD" || t === "LOAN";

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
      : target?.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : target?.accountType ? "BANK_ACCOUNT" : undefined;
    createExpense({ accountId: v.accountId, categoryId: v.categoryId, amount: Number(v.amount),
      description: v.description, notes: v.notes, expenseDate: v.expenseDate, paymentMethod }, { onSuccess: close });
  };

  const handleAddTransfer = (v: TransferFormValues) => {
    doTransfer({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId,
      amount: Number(v.amount), description: v.description, transferDate: v.transferDate },
      { onSuccess: close });
  };

  const activeType = modal === "create" ? createForm.watch("accountType") : (editAccount?.accountType ?? createForm.watch("accountType"));
  const isCCForm    = activeType === "CREDIT_CARD";
  const isLoanForm  = activeType === "LOAN";

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
      // Dynamic import — see AccountCard.tsx's identical fix; jsPDF has no reason to sit in every
      // visitor's initial /accounts bundle just because one Loan card's icon might get clicked.
      onDownload={() => { void import("@/features/accounts/utils/downloadAccountStatement").then(({ downloadAccountStatement }) => downloadAccountStatement(a)); }}
      onEdit={() => openEdit(a)}
      onRecordPayment={() => setPayLoan(a)} />
  ) : (
    <AccountCard key={a.id} account={a}
      linkedDebts={debtsByAccountId.get(a.id) ?? NO_DEBTS}
      onAddMoney={() => openAddMoney(a)}
      onAddExpense={() => openAddExpense(a)}
      onTransfer={() => openTransfer(a, a.accountType === "CREDIT_CARD")}
      onImportStatement={
        a.accountType === "BANK_ACCOUNT" || a.accountType === "CASH_WALLET"
          ? () => openImportStatement(a) : undefined
      }
      {...sharedCardProps(a)} />
  );

  const allAccountsOrdered = [...bankAccounts, ...cashAccounts, ...creditCards, ...loanAccounts];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Accounts" subtitle="All your cash, bank, credit, and investment accounts in one place" />

      {confirm && (
        <ConfirmDialog open title={confirm.title} description={confirm.message}
          confirmLabel={confirm.title.startsWith("Archive") ? "Archive" : confirm.title.startsWith("Restore") ? "Restore" : confirm.title.startsWith("Close") ? "Close" : "Delete"}
          danger={!confirm.title.startsWith("Restore")}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}

      {deleteTarget && (
        <DeleteAccountModal deleteTarget={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { deleteAccount(deleteTarget.id); setDeleteTarget(null); }} />
      )}

      {payLoan && (
        <LoanPaymentModal payLoan={payLoan} accounts={accounts} fmt={fmt}
          payingLoan={payingLoan} onClose={() => setPayLoan(null)}
          onRecordPayment={(amount, fromAccountId) => recordLoanPayment(
            { id: payLoan.id, amount, fromAccountId },
            { onSuccess: () => setPayLoan(null) })} />
      )}

      {(modal === "create" || modal === "edit") && (
        <AccountFormModal
          modal={modal} editAccount={editAccount} createForm={createForm} accounts={accounts}
          bankInput={bankInput} setBankInput={setBankInput}
          showCCDetails={showCCDetails} setShowCCDetails={setShowCCDetails}
          actualBalance={actualBalance} setActualBalance={setActualBalance}
          currSymbol={currSymbol} creating={creating} updating={updating} adjusting={adjusting}
          onClose={close}
          onArchive={() => {
            if (!editAccount) return;
            const label = editAccount.accountType === "LOAN" ? "Archive Loan" : "Archive Account";
            askConfirm(label, `Archive "${editAccount.name}"? It will be hidden from all views but all history is preserved.`,
              () => archiveAccount(editAccount.id));
            close();
          }}
          onCloseAccount={() => {
            if (!editAccount) return;
            askConfirm("Close Account",
              `Close "${editAccount.name}"? This is permanent — a closed account stays visible with its history, but can no longer receive new transactions and can't be reopened.`,
              () => closeAccountMutation(editAccount.id));
            close();
          }}
          onSubmit={modal === "edit" ? onEditSubmit : onCreateSubmit}
        />
      )}

      {/* Gates the dynamic import itself — the component's own internal `modal === "x"` checks
          are one level too deep for next/dynamic to defer fetching its chunk until relevant. */}
      {(modal === "addMoney" || modal === "addExpense" || modal === "import" || modal === "transfer") && (
        <AccountTransactionModals
          modal={modal} onClose={close} accounts={activeAccounts} cashAccounts={cashAccounts}
          bankAccounts={bankAccounts} creditCards={creditCards} incomeCategories={incomeCategories}
          categoryOptions={categoryOptions} preAccount={preAccount} lockedExpenseAccount={lockedExpenseAccount}
          defaultIncomeSource={defaultIncomeSource} incomeSourceUsage={incomeSourceUsage}
          defaultExpenseCategoryId={defaultExpenseCategoryId} payBillMode={payBillMode}
          handleAddIncome={handleAddIncome} handleAddExpense={handleAddExpense} handleAddTransfer={handleAddTransfer}
          addingMoney={addingMoney} addingExpense={addingExpense} transferring={transferring}
        />
      )}


      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        <AccountStatStrip
          accounts={activeAccounts} totalAssetsAcrossAccounts={totalAssetsAcrossAccounts}
          bankAccounts={bankAccounts} bankBalance={bankBalance}
          cashAccounts={cashAccounts} cashBalance={cashBalance}
          creditCards={creditCards} creditCardDebt={creditCardDebt}
          loanAccounts={loanAccounts} loanDebt={loanDebt} fmt={fmt}
        />

        <AccountFilterTabs
          accounts={activeAccounts} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          creditCards={creditCards} loanAccounts={loanAccounts}
          sectionFilter={sectionFilter} setSectionFilter={setSectionFilter}
        />

        <AccountsGrid
          isLoading={isLoading} isError={isError} onRetry={refetch} accounts={activeAccounts} sectionFilter={sectionFilter}
          allAccountsOrdered={allAccountsOrdered} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          creditCards={creditCards} loanAccounts={loanAccounts}
          renderAccountCard={renderAccountCard} onCreate={openCreate}
        />

        <ClosedAccountsSection
          filteredClosed={filteredClosed} showClosed={showClosed} setShowClosed={setShowClosed}
          onDelete={(a) => setDeleteTarget(a)}
        />

        <ArchivedAccountsSection
          filteredArchived={filteredArchived} showArchived={showArchived} setShowArchived={setShowArchived}
          onRestore={(a) => askConfirm("Restore Account", `Restore "${a.name}"? It will appear in your active accounts again.`, () => unarchiveAccount(a.id))}
          onDelete={(a) => setDeleteTarget(a)}
        />


        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Wallet, label: "Add Account", color: "indigo", testId: "fab-add-account", onClick: () => openCreate("BANK_ACCOUNT") },
      ]} />
    </div>
  );
}
