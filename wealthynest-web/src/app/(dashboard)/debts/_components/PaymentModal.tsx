"use client";

import {useState} from "react";
import {Check, Wallet} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {CURRENCIES, usePrefsStore} from "@/store/preferences.store";
import {cn, formatCurrency} from "@/lib/utils";
import type {DebtRecord} from "@/features/debts/types/debt.types";
import {ContactAvatar} from "./ContactAvatar";

// ── Payment / Received Modal ──────────────────────────────────────────────────

export function PaymentModal({ debt, onSave, onClose, saving }: {
  debt:    DebtRecord;
  onSave:  (amount: number, note: string) => void;
  onClose: () => void;
  saving:  boolean;
}) {
  const isLent = debt.type === "LENT";
  const [amount, setAmount] = useState(debt.amountRemaining.toString());
  const [note,   setNote]   = useState("");
  const [error,  setError]  = useState("");
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";

  // Mirrors AddSavingsModal's equivalent check — the backend already rejects an overpayment
  // (recordPayment validates against the remaining balance), but only after a submit round-trip;
  // this catches it inline instead of the user finding out from a raw error toast.
  const handleSubmit = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    if (n > debt.amountRemaining) {
      setError(`Cannot ${isLent ? "receive" : "pay"} more than ${formatCurrency(debt.amountRemaining)} remaining.`);
      return;
    }
    setError("");
    onSave(n, note);
  };

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2.5 mb-4">
          <ContactAvatar name={debt.contactName} isLent={isLent} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {isLent ? "Mark as Received" : "Record Payment"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isLent ? `Receiving from ${debt.contactName}` : `Paying back ${debt.contactName}`}
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{formatCurrency(debt.amount)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Remaining</span>
            <span className={cn("font-bold", isLent ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(debt.amountRemaining)}
            </span>
          </div>
          {debt.accountName && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
              <Wallet className="w-3 h-3" /> {debt.accountName}
            </div>
          )}
        </div>

        <div className="space-y-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {isLent ? "Amount Received" : "Amount Paying"}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/80">{currSymbol}</span>
              <input type="text" inputMode="decimal" value={amount} data-testid="debt-payment-amount-input"
                onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")); setError(""); }}
                placeholder="0"
                className="w-full h-11 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all" />
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{error}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/80">(optional)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UPI transfer"
              className="w-full h-11 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all" />
          </div>
        </div>

        {debt.accountName && Number(amount) > 0 && (
          <p className="text-[11px] text-indigo-500/80 px-1 mt-3">
            {isLent
              ? `${formatCurrency(Number(amount))} will be credited back to ${debt.accountName}`
              : `${formatCurrency(Number(amount))} will be debited from ${debt.accountName}`}
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="h-12 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
          <button data-testid="debt-payment-submit" onClick={handleSubmit}
            disabled={saving || !amount || Number(amount) <= 0}
            className={cn(
              "flex-1 h-12 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2",
              isLent
                ? "bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40"
                : "bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
            )}>
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Saving…" : isLent ? "Mark Received" : "Record Payment"}
          </button>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}
