"use client";

import {useState} from "react";
import {
    AlertTriangle,
    ArrowUpDown,
    BadgeCheck,
    Calendar,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    PieChart,
    Plus,
    Repeat,
    Tag,
    Target,
    Users,
    Wallet,
} from "lucide-react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {TableRowSkeleton} from "@/components/shared/LoadingSkeleton";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {FormSelect} from "@/components/forms/FormSelect";
import {Button} from "@/components/ui/Button";
import {Card} from "@/components/ui/Card";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {Toggle} from "@/components/ui/Toggle";
import {Tooltip} from "@/components/ui/Tooltip";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {CategoryPicker} from "@/components/transactions/CategoryPicker";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {CATEGORY_COLOR_PALETTE, CATEGORY_ICON_LIST, suggestUnusedCombo} from "@/lib/categoryIcons";
import {useBudgets, useCreateBudget, useDeleteBudget,} from "@/features/budgets/hooks/useBudgets";
import {useCategories, useCreateCategory} from "@/features/categories/hooks/useCategories";
import {type BudgetFormValues, budgetSchema} from "@/features/budgets/schemas/budget.schema";
import {BudgetDetailModal} from "@/features/budgets/components/BudgetDetailModal";
import {BudgetTypeTabs} from "./_components/BudgetTypeTabs";
import type {Budget, BudgetType} from "@/features/budgets/types/budget.types";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {useAuthStore} from "@/features/auth/store/auth.store";
import {toast} from "sonner";

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const ALERT_OPTIONS = [
  { value: "50", label: "50%" }, { value: "60", label: "60%" },
  { value: "70", label: "70%" }, { value: "75", label: "75%" },
  { value: "80", label: "80% (default)" }, { value: "90", label: "90%" },
  { value: "100", label: "100%" },
];

// ─── Budget Row — one clickable row per budget, no separate edit/delete icons ─

function BudgetRow({ budget, onEdit }: { budget: Budget; onEdit: () => void }) {
  const { fmt } = useAmountFormatter();
  const pct      = Math.min(100, budget.percentUsed);
  const alert    = budget.alertThreshold ?? 80;
  const pctColor = budget.overBudget ? "text-red-600 dark:text-red-400" : budget.percentUsed > alert ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  const catName  = budget.categoryName ?? "Budget";
  const catColor = getCategoryColor(catName, budget.categoryColor);
  const catIcon  = getCategoryIcon({ name: catName, icon: budget.categoryIcon });

  return (
    <button type="button" onClick={onEdit}
      aria-label={`Edit ${catName} budget, ${budget.percentUsed.toFixed(0)}% used`}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left">
      <PremiumIcon icon={catIcon} hex={catColor} size="sm" className="w-9 h-9" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {budget.overBudget && <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />}
            <span className="text-sm font-medium text-foreground truncate">{catName}</span>
            {budget.shared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Users className="w-2.5 h-2.5" /> Shared
              </span>
            )}
            {budget.rolloverAmount > 0 && (
              <span title={`${fmt(budget.rolloverAmount)} carried over from last month`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shrink-0">
                <Repeat className="w-2.5 h-2.5" /> +{fmt(budget.rolloverAmount)}
              </span>
            )}
          </div>
          <span className={cn("text-xs font-bold tabular-nums shrink-0", pctColor)}>{budget.percentUsed.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
          <div className={cn("h-full rounded-full transition-all duration-500",
            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground/70 tabular-nums">
            {fmt(budget.spent)} / {fmt(budget.amount)}{budget.rolloverAmount > 0 && ` + ${fmt(budget.rolloverAmount)}`}
          </span>
          <span className={cn("text-xs", budget.overBudget ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground/80")}>
            {budget.overBudget ? `Over by ${fmt(Math.abs(budget.remaining))}` : `${fmt(budget.remaining)} left`}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetsPage() {
  const { fmt } = useAmountFormatter();
  const { user } = useAuthStore();
  const inFamily = !!user?.familyId;
  const now = new Date();
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [showForm,    setShowForm]    = useState(false);
  const [editBudget,  setEditBudget]  = useState<Budget | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [budgetType,  setBudgetType]  = useState<BudgetType>("MONTHLY");
  const [activeType,  setActiveType]  = useState<BudgetType>("MONTHLY");
  const [showAddCat,  setShowAddCat]  = useState(false);
  const [newCatName,  setNewCatName]  = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLOR_PALETTE[0]);
  const [newCatIcon,  setNewCatIcon]  = useState(CATEGORY_ICON_LIST[0].key);
  const [sortByUsage, setSortByUsage] = useState(false);

  const { data: budgets = [], isLoading, isError, refetch } = useBudgets(year, month);
  const { mutate: createBudget, isPending }              = useCreateBudget();
  const { mutate: deleteBudget }                         = useDeleteBudget();
  const { data: categories = [] }                        = useCategories("EXPENSE");
  const { mutate: createCategory, isPending: creatingCat } = useCreateCategory();

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { budgetType: "MONTHLY", alertThreshold: 80, rollover: false },
  });
  const watchedCategoryId = form.watch("categoryId");
  const watchedRollover   = form.watch("rollover");

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const existingCategoryIds = new Set(budgets.map(b => b.categoryId));
  const availableCategories = categories.filter(c => !existingCategoryIds.has(c.id));

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    createCategory({ name: newCatName.trim(), color: newCatColor, icon: newCatIcon, type: "EXPENSE" }, {
      onSuccess: (cat) => {
        form.setValue("categoryId", cat.id);
        setNewCatName(""); setShowAddCat(false);
      },
    });
  };

  // Pre-selects the nearest icon+color pair no existing expense category is using yet,
  // same suggestion logic as the Settings → Categories picker.
  const openAddCategory = () => {
    if (!showAddCat) {
      const suggestion = suggestUnusedCombo(categories);
      setNewCatIcon(suggestion.icon);
      setNewCatColor(suggestion.color);
    }
    setShowAddCat(v => !v);
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
      { categoryId: v.categoryId, budgetType, amount: Number(v.amount), alertThreshold: v.alertThreshold ? Number(v.alertThreshold) : undefined, rollover: budgetType === "MONTHLY" ? v.rollover : false },
      {
        onSuccess: () => {
          form.reset({ budgetType: "MONTHLY", alertThreshold: 80, rollover: false });
          setShowForm(false);
          // Jump to whichever tab the new budget actually lives in — it's the one thing worth
          // seeing right after creating it, and the tabs only ever show one type's list at a time.
          setActiveType(budgetType);
        },
      }
    );
  };

  const sorted = (list: Budget[]) =>
    sortByUsage ? [...list].sort((a, b) => b.percentUsed - a.percentUsed) : list;

  const monthlyBudgets = sorted(budgets.filter(b => b.budgetType === "MONTHLY"));
  const yearlyBudgets  = sorted(budgets.filter(b => b.budgetType === "YEARLY"));

  const monthlyBudgeted  = monthlyBudgets.reduce((s, b) => s + b.amount, 0);
  const monthlySpent     = monthlyBudgets.reduce((s, b) => s + b.spent, 0);
  const yearlyBudgeted   = yearlyBudgets.reduce((s, b) => s + b.amount, 0);
  const yearlySpent      = yearlyBudgets.reduce((s, b) => s + b.spent, 0);

  // Monthly and yearly budgets live on different time bases (a monthly amount recurs
  // every month, a yearly amount doesn't) — summing them raw would understate the true
  // annual commitment. Annualize monthly (×12) before combining with yearly (as-is).
  // annualSpent (from the API) is the actual full-calendar-year spend in each budget's
  // category regardless of type, so it pairs honestly with annualBudgeted — no extrapolation.
  const annualBudgeted   = monthlyBudgeted * 12 + yearlyBudgeted;
  const annualSpent      = budgets.reduce((s, b) => s + b.annualSpent, 0);
  const annualRemaining  = Math.max(0, annualBudgeted - annualSpent);
  const overBudgetCount  = budgets.filter(b => b.overBudget).length;

  return (
    <div className="flex flex-col flex-1">
      <Header title="Budgets" subtitle="Set spending limits by category and track how you're pacing" />
      {editBudget && (
        <BudgetDetailModal budget={editBudget} onClose={() => setEditBudget(null)}
          onDelete={() => { setConfirmId(editBudget.id); setEditBudget(null); }} />
      )}
      {confirmId && (
        <ConfirmDialog open title="Delete Budget"
          description="This budget will be permanently deleted. Historical expense data is kept."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteBudget(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {showForm && (
        <TransactionModalOverlay onDismiss={() => setShowForm(false)}>
          <FormModalShell accent="from-amber-500 to-orange-600">
              <FormModalHeader icon={PieChart} tone="orange" title="New Budget" onClose={() => setShowForm(false)} />
              <p className="text-xs text-muted-foreground -mt-3 mb-4">
                Budgets persist across months — navigate months to compare spending.
                {inFamily && " Since you're in a family group, this budget will be shared and its spend combines everyone's expenses in this category."}
              </p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {(["MONTHLY", "YEARLY"] as BudgetType[]).map(t => (
                  <button key={t} type="button" data-testid={`budget-type-${t}`}
                    onClick={() => { setBudgetType(t); form.setValue("budgetType", t); }}
                    className={cn("flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-medium transition-all border",
                      budgetType === t
                        ? "bg-amber-700 border-amber-500 text-white"
                        : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                    {t === "MONTHLY" ? <Calendar className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
                    {t === "MONTHLY" ? "Monthly" : "Yearly"}
                  </button>
                ))}
                <span className="text-xs text-muted-foreground self-center ml-1">
                  {budgetType === "MONTHLY" ? "Resets each month" : "Tracks full-year spending"}
                </span>
              </div>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <CategoryPicker
                  categories={availableCategories.map(c => ({ value: c.id, label: c.name, icon: c.icon, color: c.color }))}
                  value={watchedCategoryId ?? ""}
                  onChange={id => form.setValue("categoryId", id, { shouldValidate: true })}
                  error={form.formState.errors.categoryId?.message}
                  manageHref="/settings/categories"
                  testId="budget-category-picker"
                />
                <button type="button" onClick={openAddCategory}
                  className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors">
                  <Tag className="w-3 h-3" /> {showAddCat ? "Cancel" : "Add custom category"}
                </button>
                {showAddCat && (
                  <div className="bg-muted/60 border border-border/60 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-medium text-foreground">New Category</p>
                    <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name"
                      className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-500 transition-colors" />
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Icon</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_ICON_LIST.map(({ key, icon }) => (
                          <button key={key} type="button" onClick={() => setNewCatIcon(key)}
                            className={cn("rounded-lg transition-all", newCatIcon === key ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100")}>
                            <PremiumIcon icon={icon} hex={newCatColor} size="xs" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_COLOR_PALETTE.map(c => (
                          <button key={c} type="button" onClick={() => setNewCatColor(c)}
                            className="w-6 h-6 rounded-full border-2 transition-all"
                            style={{ background: c, borderColor: newCatColor === c ? "white" : "transparent" }} />
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={handleAddCategory} disabled={!newCatName.trim() || creatingCat}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-60 transition-all">
                      <Check className="w-3.5 h-3.5" /> {creatingCat ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
                <BigAmountInput colorClass="text-amber-500 dark:text-amber-400" testId="budget-amount-input"
                  error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />
                <FormSelect label="Alert At (%)" options={ALERT_OPTIONS} {...form.register("alertThreshold")} />
                {budgetType === "MONTHLY" && (
                  <div className="flex items-center justify-between gap-3 bg-muted/40 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Roll over unused amount</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Unspent budget carries into next month only — it never compounds further.</p>
                    </div>
                    <Toggle checked={!!watchedRollover} onChange={v => form.setValue("rollover", v)} testId="budget-rollover-toggle" />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button type="submit" data-testid="budget-form-submit" variant="gradient" loading={isPending}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25 disabled:shadow-none">
                    {isPending ? "Saving…" : "Create"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
          </FormModalShell>
        </TransactionModalOverlay>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Navigator + Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(-1)} aria-label="Previous month"
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="text-center min-w-40">
              <span className="text-sm font-semibold text-foreground">{monthLabel(year, month)}</span>
              <p className="text-xs text-muted-foreground leading-tight">Monthly budgets · Yearly shows {year}</p>
            </div>
            <button onClick={() => navigate(1)} disabled={isCurrentMonth} aria-label="Next month"
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            {!isCurrentMonth && (
              <button onClick={goToToday}
                className="h-7 px-2.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-medium hover:bg-amber-600/30 transition-all">
                Today
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={sortByUsage ? "Sorted by usage" : "Sort by usage"}>
              <button onClick={() => setSortByUsage(v => !v)}
                aria-pressed={sortByUsage}
                aria-label={sortByUsage ? "Sorted by usage" : "Sort by usage"}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  sortByUsage
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30"
                    : "hover:bg-muted"
                )}>
                <ArrowUpDown className={cn("w-4 h-4", sortByUsage ? "text-white" : "text-muted-foreground")} />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Summary */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <PremiumIcon icon={Wallet} tone="orange" size="xs" className="mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Budgeted This Year</p>
              <p className="text-lg font-bold text-foreground tabular-nums">{fmt(annualBudgeted)}</p>
              {(monthlyBudgeted > 0 || yearlyBudgeted > 0) && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {monthlyBudgeted > 0 && (
                    <span className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium tabular-nums">
                      <Calendar className="w-2.5 h-2.5" /> {fmt(monthlyBudgeted)}<span className="opacity-60">/mo×12</span>
                    </span>
                  )}
                  {yearlyBudgeted > 0 && (
                    <span className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium tabular-nums">
                      <CalendarDays className="w-2.5 h-2.5" /> {fmt(yearlyBudgeted)}<span className="opacity-60">/yr</span>
                    </span>
                  )}
                </div>
              )}
            </Card>
            <Card className="p-4">
              <PremiumIcon icon={Target} tone="red" size="xs" className="mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Spent This Year</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmt(annualSpent)}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 pl-1 pr-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                <BadgeCheck className="w-2.5 h-2.5" /> Actual · Jan–Dec {year}
              </span>
            </Card>
            <Card className="p-4">
              <PremiumIcon icon={Check} tone="green" size="xs" className="mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Remaining This Year</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(annualRemaining)}</p>
            </Card>
            <Card className={cn("p-4", overBudgetCount > 0 && "border-red-500/30")}>
              <PremiumIcon icon={AlertTriangle} tone={overBudgetCount > 0 ? "red" : "gray"} size="xs" className="mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Over Budget</p>
              <p className={cn("text-lg font-bold tabular-nums",
                overBudgetCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"}
              </p>
            </Card>
          </div>
        )}

        {/* Budget lists */}
        <BudgetTypeTabs value={activeType} onChange={setActiveType}
          monthlyCount={monthlyBudgets.length} yearlyCount={yearlyBudgets.length} />

        {(() => {
          const isMonthly = activeType === "MONTHLY";
          const list = isMonthly ? monthlyBudgets : yearlyBudgets;
          const typeBudgeted = isMonthly ? monthlyBudgeted : yearlyBudgeted;
          const typeSpent = isMonthly ? monthlySpent : yearlySpent;
          const label = isMonthly ? "Monthly Budgets" : "Yearly Budgets";
          const icon = isMonthly ? Calendar : CalendarDays;
          const tone = isMonthly ? "blue" : "violet";

          return (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 flex-wrap">
                <PremiumIcon icon={icon} tone={tone} size="xs" />
                <span className="font-semibold text-foreground text-sm">{label}</span>
                {!isMonthly && <span className="text-xs text-muted-foreground">({year})</span>}
                {list.length > 0 && (
                  <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Budgeted <span className="text-foreground font-medium">{fmt(typeBudgeted)}</span></span>
                    <span>Spent <span className="text-red-600 dark:text-red-400 font-medium">{fmt(typeSpent)}</span></span>
                    <span>Left <span className={cn("font-medium", typeSpent > typeBudgeted ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{fmt(Math.max(0, typeBudgeted - typeSpent))}</span></span>
                  </div>
                )}
              </div>
              {isLoading ? <TableRowSkeleton rows={3} /> : isError ? (
                <QueryErrorState onRetry={() => refetch()} description="Couldn't load your budgets. Check your connection and try again." />
              ) : list.length === 0 ? (
                <EmptyState icon={Target} title={`No ${isMonthly ? "monthly" : "yearly"} budgets`}
                  description={`Create a ${isMonthly ? "monthly" : "yearly"} budget to track spending limits.`}
                  action={
                    <button onClick={() => { setShowForm(true); setBudgetType(activeType); }}
                      className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                      <Plus className="w-4 h-4" /> Create {isMonthly ? "Monthly" : "Yearly"} Budget
                    </button>
                  } />
              ) : (
                <div className="divide-y divide-border/40">
                  {list.map(b => (
                    <BudgetRow key={b.id} budget={b} onEdit={() => setEditBudget(b)} />
                  ))}
                </div>
              )}
            </Card>
          );
        })()}
        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Target, label: "Add Budget", color: "amber", testId: "fab-add-budget", onClick: () => setShowForm(true) },
      ]} />
    </div>
  );
}
