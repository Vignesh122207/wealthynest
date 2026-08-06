"use client";

import Link from "next/link";
import {Handshake} from "lucide-react";
import {cn} from "@/lib/utils";
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

  // Green only when it's purely money owed TO the user (an asset) — matches Smart Insights'
  // own good/bad color convention. Any BORROWED amount means there's a liability in the mix
  // too, so it stays red rather than framing debt the user owes as a win.
  const isReceivable = totalBorrowed === 0 && totalLent > 0;

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
      // Same pill shape as a Smart Insights row (rounded-xl, px-3 py-2.5, tinted bg/border at
      // 8%/15% opacity) instead of a bespoke card, single line.
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors animate-fade-in-up",
        isReceivable
          ? "bg-emerald-500/8 border border-emerald-500/15 hover:bg-emerald-500/12"
          : "bg-red-500/8 border border-red-500/15 hover:bg-red-500/12"
      )}
    >
      <PremiumIcon icon={Handshake} tone={isReceivable ? "green" : "red"} size="xs" />
      <p className="flex-1 text-xs text-foreground/90 leading-snug min-w-0 truncate">
        <span className="font-semibold text-foreground">{parts.join(" · ")}</span>
        {nextDue && dueLabel && (
          <span className="text-muted-foreground"> · {dueLabel} — {nextDue.contactName}</span>
        )}
      </p>
      <span className="text-xs font-semibold text-primary shrink-0">View debts →</span>
    </Link>
  );
}
