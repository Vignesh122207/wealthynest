"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Pencil, PieChart, Receipt, Repeat, Users} from "lucide-react";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {Button} from "@/components/ui/Button";
import {Toggle} from "@/components/ui/Toggle";
import {FormSelect} from "@/components/forms/FormSelect";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {CategoryPicker} from "@/components/transactions/CategoryPicker";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {useUpdateBudget} from "@/features/budgets/hooks/useBudgets";
import {useCategories} from "@/features/categories/hooks/useCategories";
import {useExpenses} from "@/features/expenses/hooks/useExpenses";
import {useFamilyExpenses} from "@/features/family/hooks/useFamily";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {type EditBudgetFormValues, editBudgetSchema} from "@/features/budgets/schemas/budget.schema";
import type {Budget} from "@/features/budgets/types/budget.types";
import {cn, formatDate} from "@/lib/utils";

const ALERT_OPTIONS = [
  { value: "50", label: "50%" }, { value: "60", label: "60%" },
  { value: "70", label: "70%" }, { value: "75", label: "75%" },
  { value: "80", label: "80% (default)" }, { value: "90", label: "90%" },
  { value: "100", label: "100%" },
];

function periodRange(budget: Budget): { startDate: string; endDate: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (budget.budgetType === "YEARLY") {
    return { startDate: `${budget.periodYear}-01-01`, endDate: `${budget.periodYear}-12-31` };
  }
  const lastDay = new Date(budget.periodYear, budget.periodMonth, 0).getDate();
  return {
    startDate: `${budget.periodYear}-${pad(budget.periodMonth)}-01`,
    endDate:   `${budget.periodYear}-${pad(budget.periodMonth)}-${pad(lastDay)}`,
  };
}

export function BudgetDetailModal({ budget, allBudgets, onClose, onDelete }: {
  budget: Budget;
  /** Full budget list (all types), used only to keep the category picker from offering a
   * category that already has a budget of this same type — see the categoryOptions comment
   * below for why this matters. */
  allBudgets: Budget[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"edit" | "transactions">("edit");

  const { mutate: updateBudget, isPending } = useUpdateBudget();
  const { data: categories = [] } = useCategories("EXPENSE");
  const [selectedCategoryId, setSelectedCategoryId] = useState(budget.categoryId);
  const form = useForm<EditBudgetFormValues>({
    resolver: zodResolver(editBudgetSchema),
    defaultValues: { amount: budget.amount, alertThreshold: budget.alertThreshold ?? 80, rollover: budget.rollover },
  });
  const watchedRollover = form.watch("rollover");
  const onSubmit = (v: EditBudgetFormValues) =>
    updateBudget(
      { id: budget.id, payload: {
        amount: Number(v.amount),
        alertThreshold: v.alertThreshold ? Number(v.alertThreshold) : undefined,
        categoryId: selectedCategoryId !== budget.categoryId ? selectedCategoryId : undefined,
        rollover: budget.budgetType === "MONTHLY" ? v.rollover : undefined,
      } },
      { onSuccess: onClose }
    );

  const alert = budget.alertThreshold ?? 80;
  // Excludes categories that already have a budget of this same type (from any *other* budget
  // row — this one's own current category is never excluded, so switching back to it always
  // stays possible) — same invariant the Create form's availableCategories enforces, and the
  // backend's updateBudget now rejects server-side too if this ever gets bypassed.
  const takenCategoryIds = new Set(
    allBudgets.filter(b => b.budgetType === budget.budgetType && b.id !== budget.id).map(b => b.categoryId)
  );
  const categoryOptions = categories
    .filter(c => c.id === selectedCategoryId || !takenCategoryIds.has(c.id))
    .map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }));

  const { startDate, endDate } = periodRange(budget);
  const { data: personalPage, isLoading: personalLoading } = useExpenses(
    { categoryId: budget.categoryId, startDate, endDate, size: 100, sortDir: "desc" },
    !budget.shared
  );
  const { data: familyExpensesRaw, isLoading: familyLoading } = useFamilyExpenses(
    budget.shared ? user?.familyId : undefined, startDate, endDate
  );
  const transactions = budget.shared
    ? (familyExpensesRaw ?? []).filter(e => e.categoryId === budget.categoryId)
    : (personalPage?.data ?? []);
  const txLoading = budget.shared ? familyLoading : personalLoading;

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <FormModalShell accent="from-amber-500 to-orange-600">
        <FormModalHeader icon={PieChart} tone="orange" title={budget.categoryName ?? "Budget"} onDelete={onDelete} onClose={onClose} />
        <p className="text-xs text-muted-foreground -mt-3 mb-4 flex items-center gap-1.5">
          {budget.budgetType === "YEARLY" ? "Yearly" : "Monthly"}
          {budget.shared && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Users className="w-2.5 h-2.5" /> Shared with family
            </span>
          )}
        </p>

        <div className="bg-muted/40 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Current usage</span>
            <span className={cn("text-xs font-bold tabular-nums",
              budget.overBudget ? "text-red-600 dark:text-red-400" : budget.percentUsed > alert ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {budget.percentUsed.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full",
              budget.overBudget ? "bg-red-500" : budget.percentUsed > alert ? "bg-amber-500" : "bg-indigo-500")}
              style={{ width: `${Math.min(100, budget.percentUsed)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground/80 mt-1">
            {fmt(budget.spent)} of {fmt(budget.amount)}{budget.rolloverAmount > 0 && ` + ${fmt(budget.rolloverAmount)} rolled over`} · Alert fires at {alert}%
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-muted/60 rounded-xl p-1">
          <button type="button" onClick={() => setTab("edit")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all",
              tab === "edit" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button type="button" onClick={() => setTab("transactions")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all",
              tab === "transactions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Receipt className="w-3 h-3" /> Transactions {transactions.length > 0 && `(${transactions.length})`}
          </button>
        </div>

        {tab === "edit" ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <CategoryPicker categories={categoryOptions} value={selectedCategoryId} onChange={setSelectedCategoryId} testId="budget-edit-category-picker" />
            <BigAmountInput colorClass="text-amber-500 dark:text-amber-400" testId="budget-edit-amount-input"
              error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />
            <FormSelect label="Alert At (%)" options={ALERT_OPTIONS} error={form.formState.errors.alertThreshold?.message} {...form.register("alertThreshold")} />
            {budget.budgetType === "MONTHLY" && (
              <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl p-3">
                <div className="min-w-0 flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Roll over unused amount</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Unspent budget carries into next month only — it never compounds further.</p>
                  </div>
                </div>
                <Toggle checked={!!watchedRollover} onChange={v => form.setValue("rollover", v)} testId="budget-edit-rollover-toggle" />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" data-testid="budget-edit-submit" variant="gradient" loading={isPending}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25 disabled:shadow-none">
                {isPending ? "Saving…" : "Update"}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {txLoading ? (
              <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
            ) : transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No expenses in this category yet {budget.budgetType === "YEARLY" ? "this year" : "this month"}.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-border/50 border border-border rounded-xl">
                {transactions.map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{e.description || budget.categoryName || "Expense"}</p>
                      <p className="text-[11px] text-muted-foreground/70">{formatDate(e.expenseDate)}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums shrink-0">−{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
