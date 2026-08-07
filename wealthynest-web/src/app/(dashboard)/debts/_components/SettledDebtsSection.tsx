"use client";

import {CheckCircle2, ChevronDown} from "lucide-react";
import {cn} from "@/lib/utils";
import type {DebtPayment, DebtRecord} from "@/features/debts/types/debt.types";
import {DebtCard} from "./DebtCard";

interface SettledDebtsSectionProps {
  filteredSettled: DebtRecord[];
  showSettled: boolean;
  setShowSettled: (updater: (v: boolean) => boolean) => void;
  onEdit: (debt: DebtRecord) => void;
  onDeletePayment?: (debt: DebtRecord, payment: DebtPayment) => void;
}

// SETTLED debts are pulled out of the main list into their own collapsed section, same pattern
// as Accounts' Closed section (ClosedAccountsSection.tsx) — a fully paid-off debt shouldn't
// crowd the active list, but its contact, amount, and payment history stay reachable. Unlike a
// closed account, SETTLED isn't strictly terminal (editing the amount back up can revert it to
// Partial/Active — see debts.spec.ts), so this reuses DebtCard as-is (still editable) rather than
// a stripped-down, history-only row.
export function SettledDebtsSection({
  filteredSettled, showSettled, setShowSettled, onEdit, onDeletePayment,
}: SettledDebtsSectionProps) {
  if (filteredSettled.length === 0) return null;

  return (
    <section className="mt-2">
      <button
        onClick={() => setShowSettled(v => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="font-medium">Settled Debts ({filteredSettled.length})</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSettled && "rotate-180")} />
      </button>

      {showSettled && (
        <div className="space-y-3">
          {filteredSettled.map(debt => (
            <DebtCard key={debt.id} debt={debt} onEdit={() => onEdit(debt)} onPayment={() => {}}
              onDeletePayment={onDeletePayment ? p => onDeletePayment(debt, p) : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}
