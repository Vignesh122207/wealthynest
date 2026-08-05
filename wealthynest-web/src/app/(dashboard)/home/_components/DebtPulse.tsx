"use client";

import Link from "next/link";
import {Handshake} from "lucide-react";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import type {DebtRecord} from "@/features/debts/types/debt.types";

interface DebtPulseProps {
  debts: DebtRecord[];
}

// A one-line presence for lending/borrowing on the Home dashboard — Debts has
// its own nav item and its own money, but previously had zero visibility here.
export function DebtPulse({ debts }: DebtPulseProps) {
  const { fmt } = useAmountFormatter();
  const active = debts.filter(d => d.status !== "SETTLED");
  if (active.length === 0) return null;

  const totalLent     = active.filter(d => d.type === "LENT").reduce((s, d) => s + d.amountRemaining, 0);
  const totalBorrowed = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);

  const nextDue = active
    .filter(d => d.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
  const daysUntil = nextDue?.dueDate
    ? Math.ceil((new Date(nextDue.dueDate).getTime() - Date.now()) / 86_400_000)
    : undefined;
  const dueLabel = daysUntil == null ? undefined
    : daysUntil <= 0 ? "due today"
    : daysUntil === 1 ? "due tomorrow"
    : `due in ${daysUntil}d`;

  const parts: string[] = [];
  if (totalLent > 0)     parts.push(`${fmt(totalLent)} owed to you`);
  if (totalBorrowed > 0) parts.push(`${fmt(totalBorrowed)} you owe`);

  return (
    <Link
      href="/debts"
      // Intentionally NOT h-full: AlertsRow top-aligns its cards (items-start) instead of
      // stretching them to match a taller sibling — this card keeps its own compact, natural
      // height regardless of what it's paired with (a 2-line banner, a 3-item Insights stack).
      // bg/border intensity matched to the over-budget banner's (red-500/30 border, red-500/8
      // bg) so the pair still reads as one visual family without needing equal height to do it.
      className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/8 hover:bg-red-500/12 px-4 py-3 transition-colors animate-fade-in-up"
    >
      <PremiumIcon icon={Handshake} tone="red" size="sm" />
      <p className="flex-1 text-sm min-w-0 truncate">
        <span className="font-semibold text-foreground">{parts.join(" · ")}</span>
        {nextDue && dueLabel && (
          <span className="text-muted-foreground"> · {dueLabel} — {nextDue.contactName}</span>
        )}
      </p>
      <span className="text-xs font-semibold text-primary shrink-0">View debts →</span>
    </Link>
  );
}
