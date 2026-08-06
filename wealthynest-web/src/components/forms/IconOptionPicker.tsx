"use client";

import {useRef, useState} from "react";
import {ChevronDown, type LucideIcon, Layers} from "lucide-react";
import {cn} from "@/lib/utils";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";

export interface IconOption {
  value: string;
  label: string;
  icon:  LucideIcon;
  hex:   string;
}

// Same icon-per-row picker pattern as PurposePicker/BankNameInput — for any "choose a type"
// control backed by an icon+color map (Asset Type, Liability Type, Loan Type all have one via
// netWorthTypeMeta.ts/account.schema.ts already) instead of a plain text-only <select> that
// throws that artwork away. A button+panel picker, not a typeahead — these are always short,
// fixed lists chosen from, never searched.
export function IconOptionPicker({
  value, onChange, options, error, label, placeholder = "Select a type", testId = "icon-option-picker",
}: {
  value: string; onChange: (v: string) => void; options: IconOption[]; error?: string;
  label?: string; placeholder?: string; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(o => o.value === value);

  return (
    <div>
      {label && <label className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>}
      <button type="button" ref={triggerRef} data-testid={`${testId}-trigger`} onClick={() => setOpen(v => !v)}
        className={cn("w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all",
          "bg-background text-foreground hover:border-indigo-500/50",
          error ? "border-red-500/60" : "border-border")}>
        {selected
          ? <PremiumIcon icon={selected.icon} hex={selected.hex} size="xs" />
          : <Layers className="w-4 h-4 text-muted-foreground shrink-0" />}
        {selected
          ? <span className="flex-1 truncate">{selected.label}</span>
          : <span className="flex-1 text-muted-foreground">{placeholder}</span>}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div data-testid={`${testId}-panel`} className="flex-1 min-h-0 overflow-y-auto">
          {options.map(o => (
            <button key={o.value} type="button" data-testid={`${testId}-option-${o.value}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                o.value === value ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-muted/60")}>
              <PremiumIcon icon={o.icon} hex={o.hex} size="xs" />
              <span className="flex-1 truncate">{o.label}</span>
            </button>
          ))}
        </div>
      </DropdownPanel>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
