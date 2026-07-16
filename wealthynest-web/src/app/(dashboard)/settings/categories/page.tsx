"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ArrowLeft, Plus, Check, Lock, Tag, Banknote, Receipt, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import {
  CATEGORY_ICON_GROUPS,
  CATEGORY_ICON_MAP,
  CATEGORY_COLOR_PALETTE,
  suggestUnusedCombo,
  findDuplicateCategory,
  categoriesUsingIcon,
  categoriesUsingColor,
} from "@/lib/categoryIcons";
import { getCategoryColor } from "@/lib/categoryMeta";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/features/categories/hooks/useCategories";
import type { Category } from "@/features/categories/types/category.types";

// "Loan Interest" (expense) and "Interest" (income) are seeded with the same
// icon key ('percent') — mapping that key alone would still leave the two
// looking identical, so this system category gets its glyph overridden by
// name instead of by the shared DB key.
const NAME_ICON_OVERRIDES: Record<string, LucideIcon> = {
  "Loan Interest": Banknote,
};

function resolveIcon(iconKey?: string, categoryName?: string) {
  if (categoryName && NAME_ICON_OVERRIDES[categoryName]) return NAME_ICON_OVERRIDES[categoryName];
  return (iconKey && CATEGORY_ICON_MAP[iconKey]) ? CATEGORY_ICON_MAP[iconKey] : Tag;
}

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryFormModal({
  initial,
  categoryType,
  existingCategories,
  onSave,
  onClose,
  onDelete,
  saving,
}: {
  initial?: { id: string; name: string; icon?: string; color?: string };
  categoryType: "EXPENSE" | "INCOME";
  /** All other categories of this type (custom + system) — powers the "already used
   * elsewhere" hints and the default-to-unused suggestion; excludes `initial` itself. */
  existingCategories: { id: string; name: string; icon?: string | null; color?: string | null }[];
  onSave: (v: { name: string; icon: string; color: string }) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const others = useMemo(
    () => existingCategories.filter(c => c.id !== initial?.id),
    [existingCategories, initial?.id],
  );
  // A fresh category defaults to the nearest icon+color pair nobody else in this
  // list is using yet — most users never have to think about collisions at all.
  const suggested = useMemo(() => suggestUnusedCombo(others), [others]);

  const [name,  setName]  = useState(initial?.name  ?? "");
  const [icon,  setIcon]  = useState(initial?.icon  ?? suggested.icon);
  const [color, setColor] = useState(initial?.color ?? suggested.color);

  const isIncome = categoryType === "INCOME";
  const valid = name.trim().length >= 2;
  const duplicate = findDuplicateCategory(others, icon, color);

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card flex flex-col max-h-[90vh]">
        <div className={cn("h-1.5 bg-gradient-to-r shrink-0", isIncome ? "from-emerald-400 to-teal-500" : "from-rose-400 to-red-500")} />
        <div className="p-5 shrink-0">
          <FormModalHeader icon={resolveIcon(icon)} hex={color}
            title={initial ? "Edit Category" : `New ${isIncome ? "Income" : "Expense"} Category`}
            onDelete={onDelete} onClose={onClose} />
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isIncome ? "e.g. Rental Income" : "e.g. Gym & Fitness"}
              className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all"
            />
            {name.trim().length > 0 && name.trim().length < 2 && (
              <p className="text-[10px] text-red-500 mt-1">Minimum 2 characters</p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Color</label>
            <div className="flex flex-wrap gap-2.5">
              {CATEGORY_COLOR_PALETTE.map(c => {
                const usedBy = categoriesUsingColor(others, c);
                return (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    title={usedBy.length > 0 ? `Also used by ${usedBy.map(u => u.name).join(", ")}` : undefined}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all border-2 relative",
                      color === c ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}>
                    {color === c && <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />}
                    {usedBy.length > 0 && color !== c && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-card" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Icon</label>
            <div className="max-h-52 overflow-y-auto pr-1 space-y-3" style={{ scrollbarWidth: "thin" }}>
              {CATEGORY_ICON_GROUPS.map(group => (
                <div key={group.key}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1.5">{group.title}</p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {group.items.map(({ key: k, icon: Icon, label }) => {
                      const usedBy = categoriesUsingIcon(others, k);
                      return (
                        <button key={k} type="button" onClick={() => setIcon(k)}
                          title={usedBy.length > 0 ? `${label} — also used by ${usedBy.map(u => u.name).join(", ")}` : label}
                          className={cn("relative rounded-xl transition-all", icon === k ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100")}>
                          <PremiumIcon icon={Icon} hex={icon === k ? color : "#8E8E93"} size="sm" />
                          {usedBy.length > 0 && icon !== k && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
            <PremiumIcon icon={resolveIcon(icon)} hex={color} size="sm" className="shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Preview</p>
              <p className="text-sm font-medium text-foreground">{name || "Category Name"}</p>
            </div>
            <div className="ml-auto">
              <span className="text-[10px] px-2 py-1 rounded-full font-medium"
                style={{ backgroundColor: color + "15", color }}>
                {isIncome ? "Income" : "Expense"}
              </span>
            </div>
          </div>

          {/* Duplicate warning — a nudge, not a block: exact icon+color reuse is still saveable */}
          {duplicate && (
            <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Identical to <b>{duplicate.name}</b> — still fine to save, but a different icon or color
                will keep the two apart in charts and lists.
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { if (valid) onSave({ name: name.trim(), icon, color }); }}
              type="button"
              disabled={saving || !valid}
              className={cn("flex-1 h-11 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5 bg-gradient-to-r",
                isIncome ? "from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25" : "from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 shadow-rose-500/25")}>
              <Check className="w-3.5 h-3.5" />
              {saving ? "Saving…" : initial ? "Save Changes" : "Create Category"}
            </button>
            <button onClick={onClose} type="button"
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ category, onEdit }: {
  category: Category;
  onEdit:   () => void;
}) {
  const color = getCategoryColor(category.name, category.color);

  if (category.isSystem) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <PremiumIcon icon={resolveIcon(category.icon, category.name)} hex={color} size="sm" className="shrink-0" />
        <span className="flex-1 text-sm font-medium text-foreground leading-none">{category.name}</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-medium px-2 py-1 bg-muted/60 rounded-lg shrink-0">
          <Lock className="w-2.5 h-2.5" /> System
        </span>
      </div>
    );
  }

  return (
    <button type="button" onClick={onEdit} aria-label={`Edit ${category.name} category`}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left">
      <PremiumIcon icon={resolveIcon(category.icon, category.name)} hex={color} size="sm" className="shrink-0" />
      <span className="flex-1 text-sm font-medium text-foreground leading-none">{category.name}</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesSettingsPage() {
  const [tab,      setTab]      = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [formMode, setFormMode] = useState<"closed" | "create" | { id: string; name: string; icon?: string; color?: string }>("closed");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: allCategories = [], isLoading } = useCategories();
  const { mutate: createCategory, isPending: creating } = useCreateCategory();
  const { mutate: updateCategory, isPending: updating } = useUpdateCategory();
  const { mutate: deleteCategory, isPending: deleting } = useDeleteCategory();

  const categories  = allCategories.filter(c => c.type === tab);
  const systemCats  = categories.filter(c => c.isSystem);
  const customCats  = categories.filter(c => !c.isSystem);
  const deletingCat = allCategories.find(c => c.id === deleteId);

  const switchTab = (t: "EXPENSE" | "INCOME") => {
    setTab(t); setFormMode("closed");
  };

  const handleSave = (v: { name: string; icon: string; color: string }) => {
    if (formMode === "create") {
      createCategory({ ...v, type: tab }, { onSuccess: () => setFormMode("closed") });
    } else if (typeof formMode === "object") {
      updateCategory({ id: formMode.id, payload: v }, { onSuccess: () => setFormMode("closed") });
    }
  };

  const isExpense = tab === "EXPENSE";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Categories" subtitle="Manage expense and income categories" />
      <PageWrapper>

        <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Settings
        </Link>

        {/* Tab bar — same solid-fill-per-type template as Investments/Accounts/Debts/Transactions,
            colored to match this page's own FAB (Expense=rose, Income=emerald). */}
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {([
            { key: "EXPENSE", label: "Expense", icon: Receipt,  bg: "bg-rose-600" },
            { key: "INCOME",  label: "Income",   icon: Banknote, bg: "bg-emerald-600" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0",
                tab === t.key ? cn(t.bg, "text-white") : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              )}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold",
                tab === t.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                {allCategories.filter(c => c.type === t.key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
          <span>System categories are shared across all users and cannot be modified. Custom categories are yours to create and manage.</span>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">

            {/* System categories section */}
            {systemCats.length > 0 && (
              <>
                <div className="px-4 py-2.5 border-b border-border bg-muted/20">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> System Categories
                    <span className="font-normal ml-1 normal-case tracking-normal">({systemCats.length})</span>
                  </p>
                </div>
                <div className="divide-y divide-border/60">
                  {systemCats.map(c => (
                    <CategoryRow key={c.id} category={c} onEdit={() => {}} />
                  ))}
                </div>
              </>
            )}

            {/* Custom categories section */}
            {customCats.length > 0 && (
              <>
                <div className={cn(
                  "px-4 py-2.5 bg-muted/20",
                  systemCats.length > 0 ? "border-t border-b border-border" : "border-b border-border"
                )}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Custom Categories
                    <span className="font-normal ml-1 normal-case tracking-normal">({customCats.length})</span>
                  </p>
                </div>
                <div className="divide-y divide-border/60">
                  {customCats.map(c => (
                    <CategoryRow key={c.id} category={c}
                      onEdit={() => setFormMode({ id: c.id, name: c.name, icon: c.icon, color: c.color })} />
                  ))}
                </div>
              </>
            )}

            {/* Empty state */}
            {categories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Tag className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">No {isExpense ? "expense" : "income"} categories yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Create your first custom {isExpense ? "expense" : "income"} category to organise your finances.
                </p>
                <button onClick={() => setFormMode("create")}
                  className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all">
                  <Plus className="w-4 h-4" /> Create First Category
                </button>
              </div>
            )}

            {/* Only custom cats empty, system cats exist */}
            {customCats.length === 0 && systemCats.length > 0 && (
              <div className="px-4 py-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  No custom {isExpense ? "expense" : "income"} categories.{" "}
                  <button onClick={() => setFormMode("create")} className="text-indigo-500 hover:text-indigo-400 font-medium transition-colors">
                    Add one
                  </button>
                </p>
              </div>
            )}
          </div>
        )}

      </PageWrapper>

      {/* Form modal */}
      {formMode !== "closed" && (
        <CategoryFormModal
          initial={typeof formMode === "object" ? formMode : undefined}
          categoryType={tab}
          existingCategories={categories}
          saving={formMode === "create" ? creating : updating}
          onClose={() => setFormMode("closed")}
          onSave={handleSave}
          onDelete={typeof formMode === "object" ? () => { setDeleteId(formMode.id); setFormMode("closed"); } : undefined}
        />
      )}

      {/* Delete confirm modal */}
      {deleteId && deletingCat && (
        <ConfirmDialog open title={`Delete "${deletingCat.name}"?`}
          description="Any budgets on this category will also be removed. Existing expenses are kept and will still show this category — recreating it with the same name brings it back."
          confirmLabel={deleting ? "Deleting…" : "Delete"} danger
          onConfirm={() => deleteCategory(deleteId, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}

      <FloatingActionButton actions={[
        { icon: Receipt,  label: "New Expense Category", color: "rose",    onClick: () => { setTab("EXPENSE"); setFormMode("create"); } },
        { icon: Banknote, label: "New Income Category",  color: "emerald", onClick: () => { setTab("INCOME");  setFormMode("create"); } },
      ]} />
    </div>
  );
}
