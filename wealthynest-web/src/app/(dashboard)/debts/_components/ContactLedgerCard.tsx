"use client";

import {useState} from "react";
import {Plus} from "lucide-react";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {cn} from "@/lib/utils";
import type {DebtPayment, DebtRecord} from "@/features/debts/types/debt.types";
import type {ContactGroup} from "@/features/debts/utils/groupByContact";
import {ContactAvatar} from "./ContactAvatar";
import {DebtCard} from "./DebtCard";
import {SettledDebtsSection} from "./SettledDebtsSection";

interface ContactLedgerCardProps {
  group:            ContactGroup;
  onEdit:           (debt: DebtRecord) => void;
  onPayment:        (debt: DebtRecord) => void;
  onDeletePayment:  (debt: DebtRecord, payment: DebtPayment) => void;
  onAddTransaction: (contactName: string, contactPhone?: string) => void;
}

// One card per person, not per transaction — repeat loans/borrows with the same contact land on
// the same ledger (see groupByContact.ts) with a net position across everything still open,
// instead of N disconnected cards for one relationship. Settled transactions collapse into their
// own nested toggle (SettledDebtsSection, reused per-contact here rather than page-wide).
export function ContactLedgerCard({ group, onEdit, onPayment, onDeletePayment, onAddTransaction }: ContactLedgerCardProps) {
  const { fmt } = useAmountFormatter();
  const [showSettled, setShowSettled] = useState(false);

  // Sub-rupee netAmount drift (float remainders) shouldn't read as "still owed" — treat anything
  // under a rupee as settled up.
  const isSettledUp = Math.abs(group.netAmount) < 1;
  const isOwedToYou = group.netAmount > 0;
  const totalCount  = group.records.length + group.settledRecords.length;

  return (
    <div data-testid="contact-ledger-card" className="space-y-3">
      <div className="flex items-center gap-3">
        <ContactAvatar name={group.contactName} isLent={group.netAmount >= 0} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{group.contactName}</p>
          <p className="text-[11px] text-muted-foreground">
            {totalCount} transaction{totalCount !== 1 ? "s" : ""}
            {group.settledRecords.length > 0 && ` · ${group.settledRecords.length} settled`}
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

      {group.records.length > 0 && (
        <div className="space-y-3">
          {group.records.map(debt => (
            <DebtCard key={debt.id} debt={debt}
              onEdit={() => onEdit(debt)} onPayment={() => onPayment(debt)}
              onDeletePayment={p => onDeletePayment(debt, p)} />
          ))}
        </div>
      )}

      <SettledDebtsSection
        filteredSettled={group.settledRecords}
        showSettled={showSettled} setShowSettled={setShowSettled}
        onEdit={onEdit} onDeletePayment={onDeletePayment}
      />
    </div>
  );
}
