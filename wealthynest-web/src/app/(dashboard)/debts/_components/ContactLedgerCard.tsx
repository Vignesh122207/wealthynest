"use client";

import {Receipt} from "lucide-react";
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

// One flat, bordered ledger per person, ACTIVE relationships only — a contact with nothing active
// left doesn't get a card here at all (see page.tsx's activeGroups filter); their settled history
// lives in the page-level SettledDebtsSection instead. The contact's identity (avatar, name) lives
// once at this level; DebtTransactionRow renders each transaction as a plain divided row rather
// than its own bordered card, so avatar/name/status chrome isn't repeated per transaction underneath.
export function ContactLedgerCard({ group, onEdit, onPayment, onDeletePayment, onAddTransaction }: ContactLedgerCardProps) {
  const { fmt } = useAmountFormatter();

  // Sub-rupee netAmount drift (float remainders) shouldn't read as "still owed" — treat anything
  // under a rupee as settled up.
  const isSettledUp = Math.abs(group.netAmount) < 1;
  const isOwedToYou = group.netAmount > 0;

  // Payoff ring reflects the whole relationship (active + settled), not any single transaction —
  // a contact you've paid off 2 of 3 transactions with still shows 2/3 progress here, even though
  // the settled 2 no longer render as rows on this card.
  const allRecords   = [...group.records, ...group.settledRecords];
  const totalAmount  = allRecords.reduce((s, d) => s + d.amount, 0);
  const totalSettled = allRecords.reduce((s, d) => s + d.amountSettled, 0);
  const payoffPct    = totalAmount > 0 ? Math.min((totalSettled / totalAmount) * 100, 100) : 0;

  return (
    <div data-testid="contact-ledger-card" className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <ContactAvatar name={group.contactName} isLent={group.netAmount >= 0} pct={payoffPct} overdue={group.hasOverdue} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{group.contactName}</p>
          <p className={cn("text-[11px]", group.hasOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            {group.records.length} transaction{group.records.length !== 1 ? "s" : ""}{group.hasOverdue && " · overdue"}
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
            className="flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold text-white shrink-0 transition-all hover:-translate-y-0.5 bg-gradient-to-br from-[#d99a6c] to-[#9a5a32] shadow-md shadow-[#9a5a32]/40 hover:shadow-lg hover:shadow-[#9a5a32]/50">
            <Receipt className="w-3.5 h-3.5" /> Log transaction
          </button>
        </div>
      </div>

      <div className="border-t border-border/50 divide-y divide-border/50">
        {group.records.map(debt => (
          <DebtTransactionRow key={debt.id} debt={debt}
            onEdit={() => onEdit(debt)} onPayment={() => onPayment(debt)}
            onDeletePayment={p => onDeletePayment(debt, p)} />
        ))}
      </div>
    </div>
  );
}
