"use client";

import { useState } from "react";
import { Check, Wallet } from "lucide-react";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";
import { cn, formatCurrency } from "@/lib/utils";
import type { DebtRecord } from "@/features/debts/types/debt.types";
import { ContactAvatar } from "./ContactAvatar";

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
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";

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
              <input type="text" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                placeholder="0"
                className="w-full h-11 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
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
          <button onClick={() => Number(amount) > 0 && onSave(Number(amount), note)}
            disabled={saving || !amount || Number(amount) <= 0}
            className={cn(
              "flex-1 h-12 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2",
              isLent ? "bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
            )}>
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Saving…" : isLent ? "Mark Received" : "Record Payment"}
          </button>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}
