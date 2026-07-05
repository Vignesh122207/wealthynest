"use client";

import { useState } from "react";
import {
  Plus, Target, Trash2, ChevronLeft, ChevronRight, AlertTriangle, Pencil, X,
  Calendar, CalendarDays, Tag, Check, ArrowUpDown, ChevronDown,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget,
} from "@/features/budgets/hooks/useBudgets";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/features/categories/hooks/useCategories";
import { budgetSchema, editBudgetSchema, type BudgetFormValues, type EditBudgetFormValues } from "@/features/budgets/schemas/budget.schema";
import type { Budget, BudgetType } from "@/features/budgets/types/budget.types";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const ALERT_OPTIONS = [
  { value: "50", label: "50%" }, { value: "60", label: "60%" },
  { value: "70", label: "70%" }, { value: "75", label: "75%" },
  { value: "80", label: "80% (default)" }, { value: "90", label: "90%" },
  { value: "100", label: "100%" },
];

const COLOR_PRESETS = [
  "#6366f1","#22c55e","#f59e0b","#ef4444","#06b6d4",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#64748b",
];

// ─── Category Picker (with color dots) ────────────────────────────────────────

function CategoryPicker({ categories, value, onChange, error, existingCategoryIds }: {
  categories: { id: string; name: string; color?: string | null }[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  existingCategoryIds?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find(c => c.id === value);
  return (
    <div className="relative">
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Category</label>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full h-10 px-3 rounded-xl bg-muted/60 border border-border text-sm text-left flex items-center gap-2 hover:border-indigo-500 focus:outline-none focus:border-indigo-500 transition-colors">
        {selected ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: selected.color ?? "#6366f1" }} />
            <span className="text-foreground">{selected.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select category</span>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No categories yet</p>
          )}
          {categories.map(c => {
            const isDisabled = existingCategoryIds?.has(c.id) ?? false;
            return (
              <button key={c.id} type="button"
                onClick={() => {
                  if (isDisabled) {
                    toast.error("A budget for this category already exists this month.");
                    return;
                  }
                  onChange(c.id); setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-sm text-foreground transition-colors",
                  isDisabled && "opacity-40 cursor-not-allowed"
                )}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color ?? "#6366f1" }} />
                {c.name}
                {value === c.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ml-auto" />}
                {isDisabled && !( value === c.id) && <span className="text-[10px] text-muted-foreground/60 ml-auto">already set</span>}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// ─── Budget Bar ───────────────────────────────────────────────────────────────

function BudgetBar({ b }: { b: Budget }) {
  const pct      = Math.min(100, b.percentUsed);
  const alert    = b.alertThreshold ?? 80;
  const pctColor = b.overBudget ? "text-red-600 dark:text-red-400" : b.percentUsed > alert ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {b.overBudget && <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />}
          <span className="text-sm font-medium text-foreground truncate" title={b.categoryName ?? "Budget"}>{b.categoryName ?? "Budget"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4 text-xs text-muted-foreground">
          <CurrencyDisplay amount={b.spent} size="sm" color="muted" />
          <span className="text-muted-foreground/60">/</span>
          <CurrencyDisplay amount={b.amount} size="sm" color="muted" />
          <span className={cn("font-semibold w-10 text-right tabular-nums", pctColor)}>
            {b.percentUsed.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500",
          pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"
        )} style={{ width: `${pct}%` }} />
      </div>
      {b.overBudget
        ? <p className="text-xs text-red-600 dark:text-red-400">Over by {formatCurrency(Math.abs(b.remaining))}</p>
        : <p className="text-xs text-muted-foreground/80">{formatCurrency(b.remaining)} remaining</p>
      }
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ budget, onClose }: { budget: Budget; onClose: () => void }) {
  const { mutate: updateBudget, isPending } = useUpdateBudget();
  const { data: categories = [] } = useCategories("EXPENSE");
  const [selectedCategoryId, setSelectedCategoryId] = useState(budget.categoryId);
  const form = useForm<EditBudgetFormValues>({
    resolver: zodResolver(editBudgetSchema),
    defaultValues: {
      amount:         budget.amount,
      alertThreshold: budget.alertThreshold ?? 80,
    },
  });
  const onSubmit = (v: EditBudgetFormValues) =>
    updateBudget(
      {
        id: budget.id,
        payload: {
          amount: Number(v.amount),
          alertThreshold: v.alertThreshold ? Number(v.alertThreshold) : undefined,
          categoryId: selectedCategoryId !== budget.categoryId ? selectedCategoryId : undefined,
        },
      },
      { onSuccess: onClose }
    );

  const alert = budget.alertThreshold ?? 80;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Edit Budget</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {budget.categoryName} · {budget.budgetType === "YEARLY" ? "Yearly" : "Monthly"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
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
            {formatCurrency(budget.spent)} spent · Alert fires at {alert}%
          </p>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <CategoryPicker
            categories={categories}
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
          />
          <FormCurrencyInput label="New Budget Limit" placeholder="0"
            error={form.formState.errors.amount?.message} {...form.register("amount")} />
          <FormSelect label="Alert At (%)" options={ALERT_OPTIONS} error={form.formState.errors.alertThreshold?.message} {...form.register("alertThreshold")} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={isPending}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
              {isPending ? "Saving…" : "Update"}
            </button>
            <button type="button" onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const now = new Date();
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [showForm,    setShowForm]    = useState(false);
  const [editBudget,  setEditBudget]  = useState<Budget | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [confirmCatId, setConfirmCatId] = useState<string | null>(null);
  const [budgetType,  setBudgetType]  = useState<BudgetType>("MONTHLY");
  const [showAddCat,  setShowAddCat]  = useState(false);
  const [newCatName,  setNewCatName]  = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PRESETS[0]);
  const [sortByUsage, setSortByUsage] = useState(false);

  const { data: budgets = [], isLoading } = useBudgets(year, month);
  const { mutate: createBudget, isPending }              = useCreateBudget();
  const { mutate: deleteBudget }                         = useDeleteBudget();
  const { data: categories = [] }                        = useCategories("EXPENSE");
  const { mutate: createCategory, isPending: creatingCat } = useCreateCategory();
  const { mutate: deleteCategory }                       = useDeleteCategory();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { budgetType: "MONTHLY", alertThreshold: 80 },
  });
  const watchedCategoryId = form.watch("categoryId");

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const existingCategoryIds = new Set(budgets.map(b => b.categoryId));

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    createCategory({ name: newCatName.trim(), color: newCatColor, type: "EXPENSE" }, {
      onSuccess: (cat) => {
        form.setValue("categoryId", cat.id);
        setNewCatName(""); setNewCatColor(COLOR_PRESETS[0]); setShowAddCat(false);
      },
    });
  };

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  const goToToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); };

  const onSubmit = (v: BudgetFormValues) => {
    if (existingCategoryIds.has(v.categoryId)) {
      toast.error("A budget for this category already exists this month.");
      return;
    }
    createBudget(
      { categoryId: v.categoryId, budgetType, amount: Number(v.amount), alertThreshold: v.alertThreshold ? Number(v.alertThreshold) : undefined },
      { onSuccess: () => { form.reset({ budgetType: "MONTHLY", alertThreshold: 80 }); setShowForm(false); } }
    );
  };

  const sorted = (list: Budget[]) =>
    sortByUsage ? [...list].sort((a, b) => b.percentUsed - a.percentUsed) : list;

  const monthlyBudgets = sorted(budgets.filter(b => b.budgetType === "MONTHLY"));
  const yearlyBudgets  = sorted(budgets.filter(b => b.budgetType === "YEARLY"));

  const totalBudgeted   = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent      = budgets.reduce((s, b) => s + b.spent,  0);
  const totalRemaining  = Math.max(0, totalBudgeted - totalSpent);
  const overBudgetCount = budgets.filter(b => b.overBudget).length;

  const monthlyBudgeted  = monthlyBudgets.reduce((s, b) => s + b.amount, 0);
  const monthlySpent     = monthlyBudgets.reduce((s, b) => s + b.spent, 0);
  const yearlyBudgeted   = yearlyBudgets.reduce((s, b) => s + b.amount, 0);
  const yearlySpent      = yearlyBudgets.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Budgets" />
      {editBudget && <EditModal budget={editBudget} onClose={() => setEditBudget(null)} />}
      {confirmId && (
        <ConfirmDialog open title="Delete Budget"
          description="This budget will be permanently deleted. Historical expense data is kept."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteBudget(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {confirmCatId && (
        <ConfirmDialog open title="Delete Category"
          description="Any budgets using this category will remain but show no category name. Delete anyway?"
          confirmLabel="Delete" danger
          onConfirm={() => { deleteCategory(confirmCatId); setConfirmCatId(null); }}
          onCancel={() => setConfirmCatId(null)} />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground text-sm">New Budget</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Budgets persist across months — navigate months to compare spending.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["MONTHLY", "YEARLY"] as BudgetType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => { setBudgetType(t); form.setValue("budgetType", t); }}
                  className={cn("flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-medium transition-all border",
                    budgetType === t
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  {t === "MONTHLY" ? <Calendar className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                  {t === "MONTHLY" ? "Monthly" : "Yearly"}
                </button>
              ))}
              <span className="text-xs text-muted-foreground self-center ml-1">
                {budgetType === "MONTHLY" ? "Resets each month" : "Tracks full-year spending"}
              </span>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <CategoryPicker
                  categories={categories}
                  value={watchedCategoryId ?? ""}
                  onChange={id => form.setValue("categoryId", id, { shouldValidate: true })}
                  error={form.formState.errors.categoryId?.message}
                  existingCategoryIds={existingCategoryIds}
                />
                <button type="button" onClick={() => setShowAddCat(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-300 transition-colors">
                  <Tag className="w-3 h-3" /> {showAddCat ? "Cancel" : "Add custom category"}
                </button>
                {showAddCat && (
                  <div className="bg-muted/60 border border-border/60 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-medium text-foreground">New Category</p>
                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name"
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 transition-colors" />
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_PRESETS.map(c => (
                          <button key={c} type="button" onClick={() => setNewCatColor(c)}
                            className="w-6 h-6 rounded-full border-2 transition-all"
                            style={{ background: c, borderColor: newCatColor === c ? "white" : "transparent" }} />
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={handleAddCategory} disabled={!newCatName.trim() || creatingCat}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 transition-all">
                      <Check className="w-3.5 h-3.5" /> {creatingCat ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
              </div>
              <FormCurrencyInput label="Budget Limit" placeholder="0"
                error={form.formState.errors.amount?.message} {...form.register("amount")} />
              <FormSelect label="Alert At (%)" options={ALERT_OPTIONS} {...form.register("alertThreshold")} />
              <div className="flex items-end gap-2">
                <button type="submit" disabled={isPending}
                  className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
                  {isPending ? "Saving…" : "Create"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Navigator + Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="text-center min-w-40">
              <span className="text-sm font-semibold text-foreground">{monthLabel(year, month)}</span>
              <p className="text-xs text-muted-foreground leading-tight">Monthly budgets · Yearly shows {year}</p>
            </div>
            <button onClick={() => navigate(1)} disabled={isCurrentMonth}
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            {!isCurrentMonth && (
              <button onClick={goToToday}
                className="h-7 px-2.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-medium hover:bg-indigo-600/30 transition-all">
                Today
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortByUsage(v => !v)}
              className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium transition-all border",
                sortByUsage
                  ? "bg-amber-600/20 border-amber-500/40 text-amber-300"
                  : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortByUsage ? "Sorted by usage" : "Sort by usage"}
            </button>
            <button onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
              <Plus className="w-4 h-4" /> Create Budget
            </button>
          </div>
        </div>

        {/* Summary */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Budgeted</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totalBudgeted)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(totalRemaining)}</p>
            </div>
            <div className={cn("bg-card border rounded-2xl p-4",
              overBudgetCount > 0 ? "border-red-500/30" : "border-border")}>
              <p className="text-xs text-muted-foreground mb-1">Over Budget</p>
              <p className={cn("text-lg font-bold tabular-nums",
                overBudgetCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"}
              </p>
            </div>
          </div>
        )}

        {/* Budget lists */}
        {[
          { label: "Monthly Budgets", icon: Calendar,     color: "text-indigo-600 dark:text-indigo-400", list: monthlyBudgets, type: "MONTHLY" as BudgetType, budgeted: monthlyBudgeted, spent: monthlySpent },
          { label: "Yearly Budgets",  icon: CalendarDays, color: "text-violet-600 dark:text-violet-400", list: yearlyBudgets,  type: "YEARLY"  as BudgetType, budgeted: yearlyBudgeted,  spent: yearlySpent  },
        ].map(({ label, icon: Icon, color, list, type, budgeted: typeBudgeted, spent: typeSpent }) => (
          <div key={type} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
              <Icon className={cn("w-4 h-4", color)} />
              <span className="font-semibold text-foreground text-sm">{label}</span>
              {type === "YEARLY" && <span className="text-xs text-muted-foreground">({year})</span>}
              <span className="text-xs text-muted-foreground">{list.length}</span>
              {list.length > 0 && (
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Budgeted <span className="text-foreground font-medium">{formatCurrency(typeBudgeted)}</span></span>
                  <span>Spent <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(typeSpent)}</span></span>
                  <span>Left <span className={cn("font-medium", typeSpent > typeBudgeted ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(Math.max(0, typeBudgeted - typeSpent))}</span></span>
                </div>
              )}
            </div>
            {isLoading ? <TableRowSkeleton rows={3} /> : list.length === 0 ? (
              <EmptyState icon={Target} title={`No ${type === "MONTHLY" ? "monthly" : "yearly"} budgets`}
                description={`Create a ${type === "MONTHLY" ? "monthly" : "yearly"} budget to track spending limits.`}
                action={
                  <button onClick={() => { setShowForm(true); setBudgetType(type); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                    <Plus className="w-4 h-4" /> Create {type === "MONTHLY" ? "Monthly" : "Yearly"} Budget
                  </button>
                } />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {list.map(b => (
                  <div key={b.id} className={cn("p-4 rounded-xl border border-border hover:bg-muted/20 group transition-colors", b.overBudget && "border-l-4 border-l-red-500")}>
                    <div className="flex items-start gap-3">
                      <div className="w-1 self-stretch rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: (b as any).categoryColor ?? "#6366f1" }} />
                      <div className="flex-1 min-w-0"><BudgetBar b={b} /></div>
                      <div className="flex items-center gap-1 shrink-0 ml-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditBudget(b)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmId(b.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Custom Categories */}
        {categories.filter(c => !c.isSystem).length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-foreground text-sm">Custom Categories</span>
              <span className="text-xs text-muted-foreground ml-auto">{categories.filter(c => !c.isSystem).length}</span>
            </div>
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {categories.filter(c => !c.isSystem).map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-muted/60 border border-border/60 rounded-lg px-3 py-1.5 group">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color ?? "#6366f1" }} />
                  <span className="text-xs text-foreground">{c.name}</span>
                  <button onClick={() => setConfirmCatId(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/80 hover:text-red-400 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Target, label: "Add Budget", color: "indigo", onClick: () => setShowForm(true) },
      ]} />
    </div>
  );
}
