"use client";

import {useState} from "react";
import {CheckCircle2, ChevronDown} from "lucide-react";
import {cn} from "@/lib/utils";
import type {DebtPayment, DebtRecord} from "@/features/debts/types/debt.types";
import {DebtTransactionRow} from "./DebtTransactionRow";

interface SettledDebtsSectionProps {
  settledDebts:    DebtRecord[];
  onEdit:          (debt: DebtRecord) => void;
  onPayment:       (debt: DebtRecord) => void;
  onDeletePayment: (debt: DebtRecord, payment: DebtPayment) => void;
}

// Page-level, not per-contact — same "pulled out of the active list, still reachable" pattern as
// Accounts' Closed Accounts section, rather than a "Settled" tab (that would mix an orthogonal
// status filter into tabs that are otherwise about type — Lent/Borrowed). A contact with nothing
// active left doesn't get their own ledger card at all (see page.tsx's activeGroups filter), so
// every settled transaction across every contact lands in this one collapsed section instead of
// scattered one-line toggles inside each card. SETTLED isn't strictly terminal (editing the
// amount back up, or removing the payment that settled it, can revert it to Partial/Active — see
// debts.spec.ts), so rows stay fully interactive here too — edit, payment history, delete payment.
export function SettledDebtsSection({ settledDebts, onEdit, onPayment, onDeletePayment }: SettledDebtsSectionProps) {
  const [open, setOpen] = useState(false);
  if (settledDebts.length === 0) return null;

  return (
    <div data-testid="settled-debts-section" className="bg-card border border-border rounded-2xl overflow-hidden">
      <button type="button" data-testid="settled-section-toggle" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors">
        <span className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-semibold text-muted-foreground">Settled ({settledDebts.length})</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-border/50 divide-y divide-border/50">
          {settledDebts.map(debt => (
            <DebtTransactionRow key={debt.id} debt={debt} showContact
              onEdit={() => onEdit(debt)} onPayment={() => onPayment(debt)}
              onDeletePayment={p => onDeletePayment(debt, p)} />
          ))}
        </div>
      )}
    </div>
  );
}
