"use client";

import {useState} from "react";
import {ChevronDown, Plus} from "lucide-react";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {cn} from "@/lib/utils";
import type {DebtPayment, DebtRecord} from "@/features/debts/types/debt.types";
import type {ContactGroup} from "@/features/debts/utils/groupByContact";
import {ContactAvatar} from "./ContactAvatar";
import {DebtTransactionRow} from "./DebtTransactionRow";

interface ContactLedgerCardProps {
  group:            ContactGroup;
  onEdit:           (debt: DebtRecord) => void;
  onPayment:        (debt: DebtRecord) => void;
  onDeletePayment:  (debt: DebtRecord, payment: DebtPayment) => void;
  onAddTransaction: (contactName: string, contactPhone?: string) => void;
}

// One flat, bordered ledger per person — the contact's identity (avatar, name) and the
// settled-history disclosure live once at this level, in the header and footer of a single
// container. DebtTransactionRow renders each transaction as a plain divided row rather than its
// own bordered card, so avatar/name/status chrome isn't repeated per transaction underneath.
export function ContactLedgerCard({ group, onEdit, onPayment, onDeletePayment, onAddTransaction }: ContactLedgerCardProps) {
  const { fmt } = useAmountFormatter();
  const [showSettled, setShowSettled] = useState(false);

  // Sub-rupee netAmount drift (float remainders) shouldn't read as "still owed" — treat anything
  // under a rupee as settled up.
  const isSettledUp = Math.abs(group.netAmount) < 1;
  const isOwedToYou = group.netAmount > 0;
  const totalCount  = group.records.length + group.settledRecords.length;

  // Payoff ring reflects the whole relationship (active + settled), not any single transaction —
  // one aggregate signal instead of a per-row progress ring repeated N times.
  const allRecords   = [...group.records, ...group.settledRecords];
  const totalAmount  = allRecords.reduce((s, d) => s + d.amount, 0);
  const totalSettled = allRecords.reduce((s, d) => s + d.amountSettled, 0);
  const payoffPct    = totalAmount > 0 ? Math.min((totalSettled / totalAmount) * 100, 100) : 0;
  const fullySettled = group.records.length === 0;

  return (
    <div data-testid="contact-ledger-card" className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <ContactAvatar name={group.contactName} isLent={group.netAmount >= 0} pct={payoffPct} settled={fullySettled} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{group.contactName}</p>
          <p className="text-[11px] text-muted-foreground">
            {totalCount} transaction{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {isSettledUp ? (
            <span data-testid="contact-net-position" className="text-xs font-medium text-muted-foreground">Settled up</span>
          ) : (
            <span data-testid="contact-net-position" className={cn("text-sm font-bold tabular-nums", isOwedToYou ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {isOwedToYou ? "Owes you " : "You owe "}{fmt(Math.abs(group.netAmount))}
            </span>
          )}
          <button type="button" data-testid="contact-add-transaction"
            onClick={() => onAddTransaction(group.contactName, group.contactPhone)}
            className="flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="border-t border-border/50 divide-y divide-border/50">
          {group.records.map(debt => (
            <DebtTransactionRow key={debt.id} debt={debt}
              onEdit={() => onEdit(debt)} onPayment={() => onPayment(debt)}
              onDeletePayment={p => onDeletePayment(debt, p)} />
          ))}

          {/* SETTLED isn't strictly terminal (editing the amount back up can revert it to
              Partial/Active — see debts.spec.ts), so this reuses DebtTransactionRow as-is (still
              editable) rather than a stripped-down, history-only row. */}
          {group.settledRecords.length > 0 && (
            <>
              <button type="button" onClick={() => setShowSettled(v => !v)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                <span>Settled Debts ({group.settledRecords.length})</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", showSettled && "rotate-180")} />
              </button>
              {showSettled && group.settledRecords.map(debt => (
                <DebtTransactionRow key={debt.id} debt={debt}
                  onEdit={() => onEdit(debt)} onPayment={() => onPayment(debt)}
                  onDeletePayment={p => onDeletePayment(debt, p)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
