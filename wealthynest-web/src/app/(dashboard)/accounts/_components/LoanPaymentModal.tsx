"use client";

import {HandCoins} from "lucide-react";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {FormSelect} from "@/components/forms/FormSelect";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {formatCurrencyCompact} from "@/lib/utils";
import type {WalletAccount} from "@/features/accounts/types/account.types";

interface LoanPaymentModalProps {
  payLoan: WalletAccount;
  accounts: WalletAccount[];
  fmt: (n: number) => string;
  payAmount: string;
  setPayAmount: (v: string) => void;
  payFrom: string;
  setPayFrom: (v: string) => void;
  payingLoan: boolean;
  onClose: () => void;
  onRecordPayment: (amount: number, fromAccountId: string | undefined) => void;
}

// Loan payment modal — backend splits interest vs principal. Pulled out of the Accounts page
// purely to cut its size; every value here is already computed/held by the page.
export function LoanPaymentModal({
  payLoan, accounts, fmt, payAmount, setPayAmount, payFrom, setPayFrom, payingLoan, onClose, onRecordPayment,
}: LoanPaymentModalProps) {
  const amt         = parseFloat(payAmount) || 0;
  const outstanding = Math.max(0, payLoan.currentBalance);
  const estInterest = payLoan.apr ? Math.min(amt, Math.round(outstanding * payLoan.apr / 12) / 100) : 0;
  const payFromOptions = accounts
    .filter(a => a.accountType === "BANK_ACCOUNT" || a.accountType === "CASH_WALLET" || a.accountType === "EMERGENCY_FUND")
    .map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }));

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-rose-400 to-red-500" />
        <div className="p-5">
          <FormModalHeader icon={HandCoins} tone="red" title="Record Loan Payment" onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4 truncate">{payLoan.name} — {fmt(outstanding)} outstanding</p>

          <BigAmountInput colorClass="text-rose-500 dark:text-rose-400"
            inputProps={{
              value: payAmount,
              onChange: e => setPayAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
              placeholder: payLoan.emiAmount ? String(payLoan.emiAmount) : "0",
            }} />

          <div className="mt-4 space-y-3">
            <FormSelect label="Paid from" options={payFromOptions} placeholder="Untracked source (cash outside app)"
              value={payFrom} onChange={e => setPayFrom(e.target.value)} />
          </div>

          {amt > 0 && payLoan.apr != null && payLoan.apr > 0 && (
            <div className="bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground mt-4 space-y-1">
              <div className="flex justify-between"><span>Interest (this month, est.)</span><span className="tabular-nums">{fmt(estInterest)}</span></div>
              <div className="flex justify-between font-medium text-foreground"><span>Reduces loan by (est.)</span><span className="tabular-nums">{fmt(Math.min(Math.max(0, amt - estInterest), outstanding))}</span></div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button disabled={payingLoan || amt <= 0}
              onClick={() => onRecordPayment(amt, payFrom || undefined)}
              className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-rose-500/25 transition-all disabled:opacity-60 disabled:shadow-none">
              {payingLoan ? "Recording…" : "Record Payment"}
            </button>
            <button onClick={onClose}
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}
