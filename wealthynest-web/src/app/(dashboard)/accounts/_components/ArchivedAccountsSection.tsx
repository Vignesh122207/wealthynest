"use client";

import {Archive, ArchiveRestore, ChevronDown, Trash2} from "lucide-react";
import {BankLogo} from "@/components/icons/BankLogo";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {cn} from "@/lib/utils";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";

interface ArchivedAccountsSectionProps {
  filteredArchived: WalletAccount[];
  showArchived: boolean;
  setShowArchived: (updater: (v: boolean) => boolean) => void;
  onRestore: (account: WalletAccount) => void;
  onDelete: (account: WalletAccount) => void;
}

export function ArchivedAccountsSection({
  filteredArchived, showArchived, setShowArchived, onRestore, onDelete,
}: ArchivedAccountsSectionProps) {
  if (filteredArchived.length === 0) return null;

  return (
    <section className="mt-2">
      <button
        onClick={() => setShowArchived(v => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
      >
        <Archive className="w-3.5 h-3.5" />
        <span className="font-medium">Archived Accounts ({filteredArchived.length})</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showArchived && "rotate-180")} />
      </button>

      {showArchived && (
        <div className="space-y-3">
          {filteredArchived.map(a => {
            const meta = ACCOUNT_TYPE_META[a.accountType as AccountType] ?? ACCOUNT_TYPE_META.BANK_ACCOUNT;
            return (
              <div key={a.id} data-testid="archived-account-row" className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                <BankLogo name={a.bankName} fallbackIcon={meta.icon} fallbackHex={meta.hex} size="sm" className="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{meta.label}{a.bankName ? ` · ${a.bankName}` : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onRestore(a)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => onDelete(a)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
