"use client";

import { useRef, useState } from "react";
import { ChevronDown, Tag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryMeta";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { DropdownPanel } from "./DropdownPanel";

// ─── Category Picker — icon per category, same visual language as AccountPicker ──

interface CategoryOption { value: string; label: string; icon?: string | null; color?: string | null; }

export function CategoryPicker({ label = "Category", placeholder = "Select category", categories, value, onChange, error, iconFor, manageHref, compact = false }: {
  label?: string; placeholder?: string;
  categories: CategoryOption[]; value: string; onChange: (id: string) => void; error?: string;
  iconFor?: (opt: CategoryOption) => { icon: LucideIcon; color: string };
  manageHref?: string;
  /** Shrinks the trigger to a dense inline control (no label/error text) for use inside tight
   * layouts like a transaction review table, instead of the full-size form-field look. */
  compact?: boolean;
}) {
  // Respects an explicitly-chosen category icon/color first (falls back to a
  // name-keyword guess only when the category never had one set) — same
  // precedence as every other resolver in the app, via getCategoryIcon/getCategoryColor.
  const resolveIcon = iconFor ?? ((opt: CategoryOption) => ({
    icon: getCategoryIcon({ name: opt.label, icon: opt.icon }),
    color: getCategoryColor(opt.label, opt.color ?? undefined),
  }));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = categories.find(c => c.value === value);
  const selectedMeta = selected ? resolveIcon(selected) : null;

  return (
    <div>
      {!compact && <label className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>}
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
        className={cn("w-full rounded-xl border flex items-center text-left transition-all",
          compact ? "h-8 px-2 gap-1.5 text-xs" : "h-11 px-3 gap-2.5 text-sm",
          "bg-background text-foreground hover:border-indigo-500/50",
          error ? "border-red-500/60" : "border-border")}>
        {selectedMeta
          ? <PremiumIcon icon={selectedMeta.icon} hex={selectedMeta.color} size="xs" />
          : <Tag className={cn("text-muted-foreground shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />}
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("text-muted-foreground/60 shrink-0 transition-transform",
          compact ? "w-3.5 h-3.5" : "w-4 h-4", open && "rotate-180")} />
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {categories.map(c => {
            const meta = resolveIcon(c);
            const isActive = value === c.value;
            return (
              <button key={c.value} type="button" onClick={() => { onChange(c.value); setOpen(false); }}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                  isActive ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-muted/60")}>
                <PremiumIcon icon={meta.icon} hex={meta.color} size="xs" />
                <span className="flex-1 truncate">{c.label}</span>
              </button>
            );
          })}
        </div>
        {manageHref && (
          <a href={manageHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-indigo-500 hover:text-indigo-600 border-t border-border shrink-0">
            <Tag className="w-3.5 h-3.5" /> Manage categories ↗
          </a>
        )}
      </DropdownPanel>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
