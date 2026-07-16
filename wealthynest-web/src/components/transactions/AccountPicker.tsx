"use client";

import { useRef, useState } from "react";
import { ChevronDown, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";
import { ACCOUNT_TYPE_META } from "@/lib/accountTypeMeta";
import { BankLogo } from "@/components/icons/BankLogo";
import { DropdownPanel } from "./DropdownPanel";

// ─── Account Picker — icon per type, star for primary, bank name only ─────────

export type PickerAccount = {
  id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean;
  kind: "CASH" | "BANK" | "CREDIT" | "EF" | "INVESTMENT";
};

// Reuses ACCOUNT_TYPE_META (the Accounts page's own source of truth) instead
// of a separate local icon map — those had drifted apart (this picker used
// Building2 for "bank", the Accounts page used Landmark for the same concept).
const KIND_TO_ACCOUNT_TYPE = {
  CASH: "CASH_WALLET", BANK: "BANK_ACCOUNT", CREDIT: "CREDIT_CARD", EF: "EMERGENCY_FUND",
  INVESTMENT: "INVESTMENT",
} as const;

export function accountPickerLabel(a: { name: string; bankName?: string }) {
  if (!a.bankName) return a.name;
  // Only collapse to the bank name when the account's own name IS the bank name (the
  // "Standard Chartered (Standard Chartered)" case) — otherwise two different products at the
  // same bank (a savings account and a credit card, say) would both show as "HDFC Bank" with
  // no way to tell them apart.
  const sameName = a.name.trim().toLowerCase() === a.bankName.trim().toLowerCase();
  return sameName ? a.bankName : a.name;
}

export function AccountPicker({
  label = "Paid Via", cashAccounts = [], bankAccounts, creditAccounts = [], emergencyFundAccounts = [],
  investmentAccounts = [], value, onChange, error, placeholder = "Select account", allowClear = false, clearLabel = "None",
}: {
  label?: string;
  cashAccounts?:   { id: string; name: string; currentBalance: number }[];
  bankAccounts:    { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  creditAccounts?: { id: string; name: string; bankName?: string; currentBalance: number }[];
  /** Optional — most callers (Expense/Income/Transfer) never pass this; Goals does, since linking a goal to an Emergency Fund account is a common case. */
  emergencyFundAccounts?: { id: string; name: string; currentBalance: number }[];
  /** Optional — Investments page passes broker/investment accounts so a buy/sell can debit or credit them directly. */
  investmentAccounts?: { id: string; name: string; bankName?: string; currentBalance: number }[];
  value: string; onChange: (id: string) => void; error?: string;
  /** Trigger text shown when nothing is selected. */
  placeholder?: string;
  /** Adds a "None" row at the top of the list so an optional field can be explicitly cleared. */
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const { fmtExact } = useAmountFormatter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accounts: PickerAccount[] = [
    ...cashAccounts.map(a => ({ ...a, kind: "CASH" as const })),
    ...bankAccounts.map(a => ({ ...a, kind: "BANK" as const })),
    ...creditAccounts.map(a => ({ ...a, kind: "CREDIT" as const })),
    ...emergencyFundAccounts.map(a => ({ ...a, kind: "EF" as const })),
    ...investmentAccounts.map(a => ({ ...a, kind: "INVESTMENT" as const })),
  ];
  const selected = accounts.find(a => a.id === value);
  const selectedMeta = selected ? ACCOUNT_TYPE_META[KIND_TO_ACCOUNT_TYPE[selected.kind]] : undefined;

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)}
        className={cn("w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all",
          "bg-background text-foreground hover:border-indigo-500/50",
          error ? "border-red-500/60" : "border-border")}>
        {selectedMeta
          ? <BankLogo name={selected?.bankName} fallbackIcon={selectedMeta.icon} fallbackHex={selectedMeta.hex} size="xs" />
          : <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />}
        {selected ? (
          <>
            <span className="flex-1 truncate">{accountPickerLabel(selected)}</span>
            {selected.primary && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
            <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">
              {fmtExact(selected.currentBalance)}{selected.kind === "CREDIT" ? " due" : ""}
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">{placeholder}</span>
        )}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {allowClear && (
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                value === "" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:bg-muted/60")}>
              <Wallet className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{clearLabel}</span>
            </button>
          )}
          {accounts.map(a => {
            const meta = ACCOUNT_TYPE_META[KIND_TO_ACCOUNT_TYPE[a.kind]];
            return (
              <button key={a.id} type="button" onClick={() => { onChange(a.id); setOpen(false); }}
                className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                  a.id === value ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-muted/60")}>
                <BankLogo name={a.bankName} fallbackIcon={meta.icon} fallbackHex={meta.hex} size="xs" />
                <span className="flex-1 truncate">{accountPickerLabel(a)}</span>
                {a.primary && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">
                  {fmtExact(a.currentBalance)}{a.kind === "CREDIT" ? " due" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </DropdownPanel>
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}
