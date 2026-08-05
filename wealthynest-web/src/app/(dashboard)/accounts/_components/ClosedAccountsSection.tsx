"use client";

import {ChevronDown, Lock, Trash2} from "lucide-react";
import {BankLogo} from "@/components/icons/BankLogo";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {cn} from "@/lib/utils";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";

interface ClosedAccountsSectionProps {
  filteredClosed: WalletAccount[];
  showClosed: boolean;
  setShowClosed: (updater: (v: boolean) => boolean) => void;
  onDelete: (account: WalletAccount) => void;
}

// CLOSED is a terminal, one-way state (loan paid off, account closed at the bank) — unlike
// Archived there's no Restore, only Delete (which the backend still only allows once the account
// has zero history, same 409-guarded guarantee as everywhere else).
export function ClosedAccountsSection({
  filteredClosed, showClosed, setShowClosed, onDelete,
}: ClosedAccountsSectionProps) {
  if (filteredClosed.length === 0) return null;

  return (
    <section className="mt-2">
      <button
        onClick={() => setShowClosed(v => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
      >
        <Lock className="w-3.5 h-3.5" />
        <span className="font-medium">Closed Accounts ({filteredClosed.length})</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showClosed && "rotate-180")} />
      </button>

      {showClosed && (
        <div className="space-y-3">
          {filteredClosed.map(a => {
            const meta = ACCOUNT_TYPE_META[a.accountType as AccountType] ?? ACCOUNT_TYPE_META.BANK_ACCOUNT;
            return (
              <div key={a.id} data-testid="closed-account-row" className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                <BankLogo name={a.bankName} fallbackIcon={meta.icon} fallbackHex={meta.hex} size="sm" className="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}{a.bankName ? ` · ${a.bankName}` : ""} · history preserved</p>
                </div>
                <button
                  onClick={() => onDelete(a)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
