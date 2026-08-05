"use client";

import {useRef, useState} from "react";
import {ChevronDown, Wallet} from "lucide-react";
import {cn} from "@/lib/utils";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {PURPOSE_OPTIONS} from "@/features/accounts/schemas/account.schema";
import {PURPOSE_ICON_META} from "@/lib/accountPurposeMeta";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";

// Same icon-per-row picker pattern as the bank/broker name inputs (BankNameInput) — a purpose is
// chosen from a fixed 11-item list rather than searched, so this is a button+panel picker (like
// AccountPicker) instead of a typeahead.
export function PurposePicker({
  value, onChange, error, label = "Purpose (optional)", placeholder = "What is this money for?",
  allowClear = true, testId = "purpose-picker",
}: {
  value: string; onChange: (v: string) => void; error?: string;
  label?: string; placeholder?: string; allowClear?: boolean; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = PURPOSE_OPTIONS.find(o => o.value === value);
  const selectedMeta = selected ? PURPOSE_ICON_META[selected.value] : undefined;

  return (
    <div>
      {label && <label className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>}
      <button type="button" ref={triggerRef} data-testid={`${testId}-trigger`} onClick={() => setOpen(v => !v)}
        className={cn("w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all",
          "bg-background text-foreground hover:border-indigo-500/50",
          error ? "border-red-500/60" : "border-border")}>
        {selectedMeta
          ? <PremiumIcon icon={selectedMeta.icon} tone={selectedMeta.tone} size="xs" />
          : <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />}
        {selected
          ? <span className="flex-1 truncate">{selected.label}</span>
          : <span className="flex-1 text-muted-foreground">{placeholder}</span>}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div data-testid={`${testId}-panel`} className="flex-1 min-h-0 overflow-y-auto">
          {allowClear && (
            <button type="button" data-testid={`${testId}-clear`} onClick={() => { onChange(""); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                value === "" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:bg-muted/60")}>
              <Wallet className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">None</span>
            </button>
          )}
          {PURPOSE_OPTIONS.map(o => {
            const meta = PURPOSE_ICON_META[o.value];
            return (
              <button key={o.value} type="button" data-testid={`${testId}-option-${o.value}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                  o.value === value ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-muted/60")}>
                <PremiumIcon icon={meta.icon} tone={meta.tone} size="xs" />
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      </DropdownPanel>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
