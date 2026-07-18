"use client";

import {Trash2} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {cn} from "@/lib/utils";
import type {WalletAccount} from "@/features/accounts/types/account.types";

interface DeleteAccountModalProps {
  deleteTarget: WalletAccount;
  alsoDeleteTx: boolean;
  setAlsoDeleteTx: (v: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

// Its own custom card (not the generic ConfirmDialog) — matches the same premium chrome as the
// rest of the app's forms (gradient bar, glossy PremiumIcon header, gradient CTA) instead of the
// plain warning-triangle look, and needs the live "also delete transactions" checkbox that a
// pre-bound confirm closure can't see update.
export function DeleteAccountModal({ deleteTarget, alsoDeleteTx, setAlsoDeleteTx, onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
        <div className="p-5">
          <FormModalHeader icon={Trash2} tone="red" title="Delete Account" onClose={onClose} />
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Delete <span className="font-medium text-foreground">&quot;{deleteTarget.name}&quot;</span>? This can&apos;t be undone.
          </p>
          <label className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-all",
            alsoDeleteTx ? "border-red-500/40 bg-red-500/8" : "border-border bg-muted/40 hover:bg-muted/60")}>
            <input type="checkbox" checked={alsoDeleteTx} onChange={e => setAlsoDeleteTx(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-red-500 shrink-0" />
            <span className="text-xs leading-snug">
              <span className="font-medium text-foreground">Also delete its expense and income entries</span>
              <br />
              <span className="text-muted-foreground">
                {alsoDeleteTx ? "History will be permanently erased." : "Otherwise history stays, just detached."}
              </span>
            </span>
          </label>
          <div className="flex gap-2 mt-4">
            <button onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="flex-1 h-10 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-red-500/25 transition-all">
              Delete
            </button>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}
