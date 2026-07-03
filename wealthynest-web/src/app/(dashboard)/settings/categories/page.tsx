"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PageWrapper } from "@/components/layout/PageWrapper";
import {
  Plus, Pencil, Trash2, X, Check, Lock,
  Utensils, ShoppingCart, Car, Zap, Heart, BookOpen, Tv, ShoppingBag,
  Home, Shield, Briefcase, Building2, DollarSign, PlusCircle, Coffee,
  Gift, Smartphone, Music, Plane, Wrench, Wallet, Target, Star, Tag,
  Package, Baby, Dumbbell, Globe, Leaf, Bike, Bus, Flame, Lightbulb,
  Stethoscope, GraduationCap, Camera, Headphones, Pizza, Wine,
  TrendingUp, Banknote, Handshake, BarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/features/categories/hooks/useCategories";
import type { Category } from "@/features/categories/types/category.types";

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  utensils:       Utensils,
  "shopping-cart": ShoppingCart,
  car:            Car,
  zap:            Zap,
  heart:          Heart,
  book:           BookOpen,
  tv:             Tv,
  "shopping-bag": ShoppingBag,
  home:           Home,
  shield:         Shield,
  briefcase:      Briefcase,
  building:       Building2,
  "dollar-sign":  DollarSign,
  "plus-circle":  PlusCircle,
  coffee:         Coffee,
  gift:           Gift,
  smartphone:     Smartphone,
  music:          Music,
  plane:          Plane,
  wrench:         Wrench,
  wallet:         Wallet,
  target:         Target,
  star:           Star,
  tag:            Tag,
  package:        Package,
  baby:           Baby,
  dumbbell:       Dumbbell,
  globe:          Globe,
  leaf:           Leaf,
  bike:           Bike,
  bus:            Bus,
  flame:          Flame,
  lightbulb:      Lightbulb,
  stethoscope:    Stethoscope,
  graduation:     GraduationCap,
  camera:         Camera,
  headphones:     Headphones,
  pizza:          Pizza,
  wine:           Wine,
  trending:       TrendingUp,
  banknote:       Banknote,
  handshake:      Handshake,
  chart:          BarChart,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
];

function CategoryIcon({ name, color, size = 16 }: { name?: string; color?: string; size?: number }) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : Tag;
  return <Icon style={{ color: color ?? "#6366f1", width: size, height: size }} />;
}

// ─── Category Form Modal ──────────────────────────────────────────────────────

function CategoryFormModal({
  initial,
  categoryType,
  onSave,
  onClose,
  saving,
}: {
  initial?: { name: string; icon?: string; color?: string };
  categoryType: "EXPENSE" | "INCOME";
  onSave: (v: { name: string; icon: string; color: string }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name,  setName]  = useState(initial?.name  ?? "");
  const [icon,  setIcon]  = useState(initial?.icon  ?? "tag");
  const [color, setColor] = useState(initial?.color ?? "#6366f1");

  const isIncome = categoryType === "INCOME";
  const valid = name.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center",
              isIncome ? "bg-emerald-500/10" : "bg-rose-500/10")}>
              <CategoryIcon name={icon} color={color} size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {initial ? "Edit Category" : `New ${isIncome ? "Income" : "Expense"} Category`}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {isIncome ? "Income" : "Expense"} · custom
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
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
              {COLOR_OPTIONS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all border-2 relative",
                    color === c ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}>
                  {color === c && <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Icon</label>
            <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {ICON_OPTIONS.map(k => {
                const Icon = ICON_MAP[k];
                return (
                  <button key={k} type="button" onClick={() => setIcon(k)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all border",
                      icon === k
                        ? "border-indigo-500/60 bg-indigo-500/10 shadow-sm"
                        : "border-transparent bg-muted/60 hover:bg-muted"
                    )}>
                    <Icon className="w-4 h-4" style={{ color: icon === k ? color : undefined }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: color + "20" }}>
              <CategoryIcon name={icon} color={color} size={16} />
            </div>
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
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex gap-2 shrink-0">
          <button onClick={onClose} type="button"
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
          <button
            onClick={() => { if (valid) onSave({ name: name.trim(), icon, color }); }}
            type="button"
            disabled={saving || !valid}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            {saving ? "Saving…" : initial ? "Save Changes" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/20 transition-colors">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: (category.color ?? "#6366f1") + "20" }}>
        <CategoryIcon name={category.icon} color={category.color ?? "#6366f1"} size={15} />
      </div>
      <span className="flex-1 text-sm font-medium text-foreground leading-none">{category.name}</span>

      {category.isSystem ? (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-medium px-2 py-1 bg-muted/60 rounded-lg shrink-0">
          <Lock className="w-2.5 h-2.5" /> System
        </span>
      ) : (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
          <button onClick={onEdit}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
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
      <Header title="Categories" />
      <PageWrapper>

        {/* Tab bar + Add button */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-2xl p-1">
            {(["EXPENSE", "INCOME"] as const).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                className={cn(
                  "px-5 h-9 rounded-xl text-sm font-medium transition-all",
                  tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {t === "EXPENSE" ? "Expense" : "Income"}
                <span className="ml-2 text-[10px] font-normal text-muted-foreground/60">
                  {allCategories.filter(c => c.type === t).length}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setFormMode("create")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shrink-0">
            <Plus className="w-4 h-4" />
            New {isExpense ? "Expense" : "Income"} Category
          </button>
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
                    <CategoryRow key={c.id} category={c} onEdit={() => {}} onDelete={() => {}} />
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
                      onEdit={() => setFormMode({ id: c.id, name: c.name, icon: c.icon, color: c.color })}
                      onDelete={() => setDeleteId(c.id)} />
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
          saving={formMode === "create" ? creating : updating}
          onClose={() => setFormMode("closed")}
          onSave={handleSave}
        />
      )}

      {/* Delete confirm modal */}
      {deleteId && deletingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Delete "{deletingCat.name}"?</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  This category will be removed. Existing transactions that use it won't be affected but it won't appear in future dropdowns.
                </p>
              </div>
              <button onClick={() => setDeleteId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 h-10 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
              <button onClick={() => deleteCategory(deleteId, { onSuccess: () => setDeleteId(null) })}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-60">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
