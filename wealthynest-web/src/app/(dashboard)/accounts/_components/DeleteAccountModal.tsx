"use client";

import {Trash2} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import type {WalletAccount} from "@/features/accounts/types/account.types";

interface DeleteAccountModalProps {
  deleteTarget: WalletAccount;
  onClose: () => void;
  onConfirm: () => void;
}

// Its own custom card (not the generic ConfirmDialog) — matches the same premium chrome as the
// rest of the app's forms (gradient bar, glossy PremiumIcon header, gradient CTA). Delete only
// ever succeeds when the account has zero history (no expense/income/transfer/investment-link/
// goal ever referenced it) — the API rejects with a 409 otherwise, surfaced as a toast pointing
// at Close/Archive instead. No "also delete transactions" option anymore: an account with real
// history is never physically deleted.
export function DeleteAccountModal({ deleteTarget, onClose, onConfirm }: DeleteAccountModalProps) {
  return (
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
        <div className="p-5">
          <FormModalHeader icon={Trash2} tone="red" title="Delete Account" onClose={onClose} />
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Delete <span className="font-medium text-foreground">&quot;{deleteTarget.name}&quot;</span>? This can&apos;t be undone.
          </p>
          <p className="text-xs text-muted-foreground/80 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            Only works if this account has no history at all — no expenses, income, transfers, linked investments, or goals.
            If it does, close or archive it instead.
          </p>
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
