"use client";

import {useState} from "react";
import {Banknote, ChevronDown, ChevronUp, Trash2} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {isDebtOverdue} from "@/features/debts/utils/isOverdue";
import type {DebtPayment, DebtRecord} from "@/features/debts/types/debt.types";

const STATUS_LABEL: Record<DebtRecord["status"], string> = {
  ACTIVE: "Active", PARTIAL: "Partial", SETTLED: "Settled",
};

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// One divided row per transaction, not its own bordered card — the contact's identity (avatar,
// name) already lives once on ContactLedgerCard's header, so this only carries what's specific to
// THIS transaction: what it was for, when, and its own payoff state. The pay action is a small
// icon-button sitting directly beside the amount it acts on (not a separate labeled pill on its
// own line below) — a full-width gradient pill per row read as a repeat of ContactLedgerCard's
// own "Log transaction" button once a card had more than one transaction, and sitting on its own
// line disconnected it visually from the figure it actually applies to. Payment history is a quiet
// right-aligned text toggle for the same reason — it's detail about the amount above it, not a
// second competing action. `showContact` is for the page-level Settled section
// (SettledDebtsSection.tsx), which has no per-contact header to supply identity, so the row names
// who it was with instead of the usual generic "Money lent/borrowed".
export function DebtTransactionRow({ debt, onEdit, onPayment, onDeletePayment, showContact }: {
  debt:             DebtRecord;
  onEdit:           () => void;
  onPayment:        () => void;
  onDeletePayment?: (payment: DebtPayment) => void;
  showContact?:     boolean;
}) {
  const { fmt } = useAmountFormatter();
  const [expanded, setExpanded] = useState(false);
  const isLent    = debt.type === "LENT";
  const isSettled = debt.status === "SETTLED";
  const overdue   = isDebtOverdue(debt);

  return (
    <div data-testid="debt-card" className={cn(isSettled && "opacity-60")}>
      <div role="button" tabIndex={0} onClick={onEdit}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
        aria-label={`Edit debt with ${debt.contactName}`}
        className="w-full flex items-start gap-3 px-4 pt-3 pb-2 text-left hover:bg-muted/30 transition-colors cursor-pointer">
        <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", isLent ? "bg-emerald-500" : "bg-red-500")} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {showContact ? (
              <>
                {debt.contactName}
                {debt.description && <span className="font-normal text-muted-foreground"> · {debt.description}</span>}
              </>
            ) : (
              debt.description || (isLent ? "Money lent" : "Money borrowed")
            )}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {fmtShortDate(debt.debtDate ?? debt.createdAt)}
            {debt.accountName && <> · {debt.accountName}</>}
            {!isSettled && debt.dueDate && (
              <> · <span className={overdue ? "text-red-500 font-medium" : undefined}>
                {overdue ? "Overdue" : `Due ${fmtShortDate(debt.dueDate)}`}
              </span></>
            )}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm font-bold tabular-nums", isLent ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {fmt(debt.amount)}
            </span>
            {!isSettled && (
              <button type="button" data-testid="debt-card-pay-button"
                title={isLent ? "Log payment" : "Pay back"}
                aria-label={isLent ? "Log payment" : "Pay back"}
                onClick={e => { e.stopPropagation(); onPayment(); }}
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-white shrink-0 transition-transform hover:scale-110 active:scale-95",
                  isLent ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                )}>
                <Banknote className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">{STATUS_LABEL[debt.status]}</span>
        </div>
      </div>

      {debt.payments.length > 0 && (
        <button type="button" data-testid="debt-payment-history-toggle"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-end gap-1 px-4 pb-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <span className="truncate">
            {debt.payments.length} payment{debt.payments.length !== 1 ? "s" : ""} · {fmt(debt.amountRemaining)} left
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
        </button>
      )}

      {expanded && debt.payments.length > 0 && (
        <div className="px-4 pb-2.5 pl-[26px] space-y-1">
          {debt.payments.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate min-w-0">
                {p.note || "Payment"} · {fmtShortDate(p.paidAt)}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-medium text-foreground">{fmt(p.amount)}</span>
                {onDeletePayment && (
                  <button type="button" data-testid="debt-payment-delete" aria-label={`Remove payment of ${fmt(p.amount)}`}
                    onClick={() => onDeletePayment(p)}
                    className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
