"use client";

import {useState} from "react";
import {AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, Wallet} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {DebtRecord} from "@/features/debts/types/debt.types";
import {ContactAvatar} from "./ContactAvatar";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DebtRecord["status"] }) {
  if (status === "SETTLED")
    return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Settled</span>;
  if (status === "PARTIAL")
    return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3" />Partial</span>;
  return <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400"><AlertCircle className="w-3 h-3" />Active</span>;
}

// ── Debt Card — whole row clickable to edit; Pay Back / history stay distinct ──

export function DebtCard({ debt, onEdit, onPayment }: {
  debt:      DebtRecord;
  onEdit:    () => void;
  onPayment: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const [expanded, setExpanded] = useState(false);
  const isLent    = debt.type === "LENT";
  const isSettled = debt.status === "SETTLED";
  const pct       = debt.amount > 0 ? Math.min((debt.amountSettled / debt.amount) * 100, 100) : 0;

  return (
    <div data-testid="debt-card" className={cn(
      "bg-card border rounded-2xl overflow-hidden transition-all",
      isSettled ? "border-border/50 opacity-60" : isLent ? "border-emerald-500/20" : "border-red-500/20"
    )}>
      {/* color strip */}
      <div className={cn("h-0.5", isLent ? "bg-emerald-500" : "bg-red-500")} />

      <button type="button" onClick={onEdit}
        aria-label={`Edit debt with ${debt.contactName}`}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
        <div className="flex gap-2 sm:gap-3">
          <ContactAvatar name={debt.contactName} isLent={isLent} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight truncate">{debt.contactName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isLent ? "You lent" : "You borrowed"} · {debt.dueDate
                    ? `Due ${new Date(debt.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : "No due date"}
                </p>
                {debt.dueDate && new Date(debt.dueDate) < new Date() && debt.status !== "SETTLED" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-medium">Overdue</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p className={cn("text-base font-bold tabular-nums", isLent ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {fmt(debt.amount)}
                </p>
                <StatusBadge status={debt.status} />
              </div>
            </div>

            {debt.accountName && (
              <div className="flex items-center gap-1 mt-1.5">
                <Wallet className="w-3 h-3 text-indigo-500/60 shrink-0" />
                <span className="text-[11px] text-indigo-500/70">{debt.accountName}</span>
              </div>
            )}

            {debt.description && (
              <p className="text-xs text-muted-foreground/80 mt-1 truncate">{debt.description}</p>
            )}

            {!isSettled && debt.amount > 0 && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isLent ? "Received" : "Paid"} {fmt(debt.amountSettled)}</span>
                  <span>Left {fmt(debt.amountRemaining)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500",
                    pct >= 70 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500"
                  )}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="px-4 pb-4 -mt-1 space-y-2">
        {!isSettled && (
          <button data-testid="debt-card-pay-button" onClick={onPayment}
            className={cn(
              "w-full h-9 rounded-xl text-xs font-semibold transition-all",
              isLent
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
            )}>
            {isLent ? "✓ Received" : "↑ Pay Back"}
          </button>
        )}

        {debt.payments.length > 0 && (
          <>
            <button onClick={() => setExpanded(v => !v)}
              className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/40 rounded-xl px-3 py-2">
              <span>{debt.payments.length} payment{debt.payments.length !== 1 ? "s" : ""}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {expanded && (
              <div className="space-y-1.5 border-t border-border/50 pt-3">
                {debt.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{p.note || "Payment"}</span>
                      <span className="text-muted-foreground/80 shrink-0">
                        {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <span className="font-semibold text-foreground shrink-0 ml-2">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
