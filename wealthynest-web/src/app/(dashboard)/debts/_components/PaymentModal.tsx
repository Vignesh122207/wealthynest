"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Check, Wallet} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormInput} from "@/components/forms/FormInput";
import {positiveAmountSchema, type PositiveAmountFormValues} from "@/components/forms/positiveAmountSchema";
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
  const [note, setNote] = useState("");

  const form = useForm<PositiveAmountFormValues>({
    resolver: zodResolver(positiveAmountSchema(debt.amountRemaining,
      `Cannot ${isLent ? "receive" : "pay"} more than ${formatCurrency(debt.amountRemaining)} remaining.`)),
    defaultValues: { amount: debt.amountRemaining },
  });
  const amount = Number(form.watch("amount") || 0);

  const handleSubmit = ({ amount }: PositiveAmountFormValues) => onSave(Number(amount), note);

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

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 mt-4">
          <FormCurrencyInput label={isLent ? "Amount Received" : "Amount Paying"}
            data-testid="debt-payment-amount-input"
            error={form.formState.errors.amount?.message} {...form.register("amount")} />
          <FormInput label="Note (optional)" placeholder="e.g. UPI transfer" value={note}
            onChange={e => setNote(e.target.value)} />

          {debt.accountName && amount > 0 && (
            <p className="text-[11px] text-indigo-500/80 px-1">
              {isLent
                ? `${formatCurrency(amount)} will be credited back to ${debt.accountName}`
                : `${formatCurrency(amount)} will be debited from ${debt.accountName}`}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-12 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
            <button type="submit" data-testid="debt-payment-submit" disabled={saving}
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
        </form>
      </div>
    </TransactionModalOverlay>
  );
}
