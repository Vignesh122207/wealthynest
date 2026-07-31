"use client";

import {useEffect, useState} from "react";
import {Check, Plus, Receipt, RefreshCw} from "lucide-react";
import {cn} from "@/lib/utils";
import {todayLocalISO} from "@/lib/date";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {CategoryPicker} from "@/components/transactions/CategoryPicker";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {FormInput} from "@/components/forms/FormInput";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {useCategories} from "@/features/categories/hooks/useCategories";
import {useAccounts} from "@/features/accounts/hooks/useAccounts";
import {useCreateExpense, useDeleteExpense, useExpenses, useUpdateExpense} from "@/features/expenses/hooks/useExpenses";
import type {Expense} from "@/features/expenses/types/expense.types";

// ─── Recurrence rule helpers ────────────────────────────────────────────────

const RULE_OPTIONS = [
  { value: "DAILY",    label: "Daily" },
  { value: "WEEKLY",   label: "Weekly" },
  { value: "BIWEEKLY", label: "Biweekly" },
  { value: "MONTHLY",  label: "Monthly" },
  { value: "YEARLY",   label: "Yearly" },
] as const;

function ruleLabel(rule?: string) {
  return RULE_OPTIONS.find(r => r.value === rule)?.label ?? "Monthly";
}

type CategoryOption = { value: string; label: string; icon?: string | null; color?: string | null };
type PickerAccounts = {
  cashAccounts:   { id: string; name: string; currentBalance: number }[];
  bankAccounts:   { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  creditAccounts: { id: string; name: string; bankName?: string; currentBalance: number }[];
};

// ─── Rule Form Modal ────────────────────────────────────────────────────────

function RuleFormModal({
  initial, categories, accounts, onSave, onClose, onDelete, saving,
}: {
  initial?: Partial<Expense>;
  categories: CategoryOption[];
  accounts: PickerAccounts;
  onSave: (v: { categoryId: string; accountId: string; amount: number; description: string; expenseDate: string; recurrenceRule: string }) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const { cashAccounts, bankAccounts, creditAccounts } = accounts;
  const [categoryId,  setCategoryId]  = useState(initial?.categoryId ?? categories[0]?.value ?? "");
  const [accountId,   setAccountId]   = useState(initial?.accountId  ?? cashAccounts[0]?.id ?? bankAccounts[0]?.id ?? creditAccounts[0]?.id ?? "");
  const [amount,      setAmount]      = useState(initial?.amount?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? todayLocalISO());
  const [rule,        setRule]        = useState(initial?.recurrenceRule ?? "MONTHLY");

  const isEdit = !!initial?.id;

  // categories/accounts can still be loading (empty) the instant this modal mounts — the
  // useState defaults above only evaluate once, so if useCategories()/useAccounts() resolve
  // after mount the pickers would otherwise be stuck on no default forever. Sync once they
  // arrive, but only for a fresh rule and only if nothing's been picked yet.
  useEffect(() => {
    if (!isEdit && !categoryId && categories[0]?.value) setCategoryId(categories[0].value);
  }, [categories, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isEdit && !accountId) {
      const fallback = cashAccounts[0]?.id ?? bankAccounts[0]?.id ?? creditAccounts[0]?.id;
      if (fallback) setAccountId(fallback);
    }
  }, [cashAccounts, bankAccounts, creditAccounts, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid  = categoryId && accountId && Number(amount) > 0 && expenseDate;
  const catMeta = categories.find(c => c.value === categoryId);
  const headerIcon = catMeta ? getCategoryIcon({ name: catMeta.label, icon: catMeta.icon }) : Receipt;
  const headerHex  = catMeta ? getCategoryColor(catMeta.label, catMeta.color ?? undefined) : undefined;

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
        <div className="p-5">
          <FormModalHeader icon={headerIcon} hex={headerHex}
            title={isEdit ? "Edit Recurring Expense" : "Add Recurring Expense"} onDelete={onDelete} onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">Auto-logs this expense on a schedule</p>

          <div className="space-y-4">
            <BigAmountInput label="Amount" colorClass="text-red-500 dark:text-red-400"
              testId="recurring-expense-amount-input"
              inputProps={{
                value: amount,
                onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
              }} />

            <CategoryPicker label="Category" placeholder="Select category" testId="recurring-expense-category-picker"
              categories={categories} value={categoryId} onChange={setCategoryId} manageHref="/settings/categories" />

            <AccountPicker label="Paid Via" testId="recurring-expense-account-picker"
              cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={creditAccounts}
              value={accountId} onChange={setAccountId} />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Repeats</label>
              <div className="flex flex-wrap gap-1.5">
                {RULE_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setRule(o.value)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      rule === o.value
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-background border-border text-muted-foreground hover:text-foreground")}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <FormDatePicker label={isEdit ? "Next Date" : "Start Date"} value={expenseDate} onChange={setExpenseDate} />

            <FormInput label="Description (optional)" placeholder="e.g. Netflix subscription"
              value={description} onChange={e => setDescription(e.target.value)} />

            <div className="flex gap-2 pt-1">
              <button type="button" disabled={saving || !valid} data-testid="recurring-expense-form-submit"
                onClick={() => valid && onSave({ categoryId, accountId, amount: Number(amount), description, expenseDate, recurrenceRule: rule })}
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-red-500/25 transition-all disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
              </button>
              <button onClick={onClose} type="button"
                className="h-11 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

// ─── Rule Card ──────────────────────────────────────────────────────────────

function RuleCard({
  expense, accountName, onEdit,
}: {
  expense:     Expense;
  accountName: string;
  onEdit:      () => void;
}) {
  const { fmt } = useAmountFormatter();
  const icon  = getCategoryIcon({ name: expense.categoryName ?? "Other", icon: expense.categoryIcon });
  const color = getCategoryColor(expense.categoryName ?? "Other", expense.categoryColor);

  return (
    <div onClick={onEdit} role="button" tabIndex={0} data-testid="recurring-expense-rule-card"
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
      aria-label={`Edit ${expense.categoryName ?? "expense"} recurring rule`}
      className="bg-card border border-border rounded-2xl p-4 transition-all cursor-pointer hover:border-rose-500/40 hover:shadow-sm hover:-translate-y-0.5 duration-200">
      <div className="flex items-start gap-3">
        <PremiumIcon icon={icon} hex={color} size="md" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{expense.categoryName ?? "Expense"}</p>
          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
            {fmt(expense.amount)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ {ruleLabel(expense.recurrenceRule).toLowerCase()}</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span>Next: {expense.expenseDate} → {accountName}</span>
          </div>
          {expense.description && (
            <p className="text-xs text-muted-foreground/80 mt-1 truncate">{expense.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab ────────────────────────────────────────────────────────────────────

type ModalState = null | "create" | Expense;

export function ExpensesTab() {
  const [modal,    setModal]    = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templatesPage, isLoading }           = useExpenses({ recurring: true, size: 100 });
  const { data: categoriesData = [] }                = useCategories("EXPENSE");
  const { data: accountsData = [] }                  = useAccounts();
  const { mutate: createExpense, isPending: creating } = useCreateExpense();
  const { mutate: updateExpense, isPending: updating } = useUpdateExpense();
  const { mutate: deleteExpense, isPending: deleting } = useDeleteExpense();

  const templates = templatesPage?.data ?? [];
  const categories: CategoryOption[] = categoriesData.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));
  const accounts: PickerAccounts = {
    cashAccounts:   accountsData.filter(a => a.accountType === "CASH_WALLET").map(a => ({ id: a.id, name: a.name, currentBalance: a.currentBalance })),
    bankAccounts:   accountsData.filter(a => a.accountType === "BANK_ACCOUNT").map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance, primary: a.primary })),
    creditAccounts: accountsData.filter(a => a.accountType === "CREDIT_CARD").map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance })),
  };
  const accountName = (id?: string) => accountsData.find(a => a.id === id)?.name ?? "Unknown Account";

  const deletingExpense = templates.find(e => e.id === deleteId);
  const isEdit    = modal !== null && modal !== "create";
  const isSaving  = isEdit ? updating : creating;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Set up auto-logged expenses for subscriptions, rent, or any recurring bill.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
            <RefreshCw className="w-7 h-7 text-rose-400" />
          </div>
          <p className="text-sm font-medium text-foreground">No recurring expenses</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add a rule to auto-log a subscription, rent, or any bill that repeats on a schedule.
          </p>
          <button onClick={() => setModal("create")}
            className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-gradient-to-br from-rose-600 to-rose-500 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 hover:-translate-y-0.5 text-white transition-all">
            <Plus className="w-4 h-4" /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(expense => (
            <RuleCard key={expense.id} expense={expense} accountName={accountName(expense.accountId)}
              onEdit={() => setModal(expense)} />
          ))}
        </div>
      )}

      {modal !== null && (
        <RuleFormModal
          initial={modal === "create" ? undefined : modal}
          categories={categories}
          accounts={accounts}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={v => {
            const payload = { ...v, recurring: true };
            if (isEdit) {
              updateExpense({ id: (modal as Expense).id, payload }, { onSuccess: () => setModal(null) });
            } else {
              createExpense(payload, { onSuccess: () => setModal(null) });
            }
          }}
          onDelete={isEdit ? () => { setDeleteId((modal as Expense).id); setModal(null); } : undefined}
        />
      )}

      {deleteId && deletingExpense && (
        <ConfirmDialog open title="Delete this rule?"
          description={`This recurring expense (${deletingExpense.categoryName ?? "expense"}) will stop generating new entries. Past expense entries won't be removed.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Rule"} danger
          onConfirm={() => deleteExpense(deleteId, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}

      <FloatingActionButton actions={[
        { icon: RefreshCw, label: "Add Recurring Expense", color: "rose", onClick: () => setModal("create"), testId: "fab-add-recurring-expense" },
      ]} />
    </>
  );
}
