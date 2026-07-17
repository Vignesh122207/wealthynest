"use client";

import { Check, Copy, Shield, TrendingUp, ArrowDownLeft, ArrowUpRight, PiggyBank, Trophy } from "lucide-react";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { SlotBar } from "@/features/family/components/SlotBar";
import { cn } from "@/lib/utils";
import type { Family, FamilyMonthlyStats } from "@/features/family/types/family.types";

const firstName = (name: string) => name.trim().split(/\s+/).filter(Boolean)[0] || name;

// ── Row 1: Net Worth hero + Invite code | Row 2: This Month stats ────────────

export function FamilyOverviewStats({
  family, membersCount, familyNetWorth, isFull, copied, copyCode, monthlyStats, fmt,
}: {
  family: Family;
  membersCount: number;
  familyNetWorth: number;
  isFull: boolean;
  copied: boolean;
  copyCode: () => void;
  monthlyStats: FamilyMonthlyStats | undefined;
  fmt: (n: number) => string;
}) {
  return (
    <>
      {/* Row 1: Net Worth hero + Invite code */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Net Worth — hero card */}
        <div className="sm:col-span-2 bg-gradient-to-br from-indigo-600/15 to-violet-600/10 border border-indigo-500/20 rounded-2xl p-5 flex items-center gap-4">
          <PremiumIcon icon={TrendingUp} tone="violet" size="lg" className="shrink-0" />
          <div>
            <p className="text-xs font-semibold text-indigo-600/80 dark:text-indigo-400/80 uppercase tracking-wider mb-0.5">Family Net Worth</p>
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{fmt(familyNetWorth)}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{membersCount} member{membersCount !== 1 ? "s" : ""} combined</p>
          </div>
        </div>

        {/* Invite code */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center gap-2">
            <PremiumIcon icon={Shield} tone="emerald" size="xs" className="shrink-0" />
            <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Invite Code</span>
            <SlotBar count={membersCount} />
          </div>
          {isFull ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">Group full — remove a member to allow new joins</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-widest text-indigo-600 dark:text-indigo-400">{family.inviteCode}</span>
              <button onClick={copyCode}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-600 dark:text-indigo-400 transition-all">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: This Month stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Income */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <PremiumIcon icon={ArrowDownLeft} tone="green" size="xs" className="mb-2" />
          <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Income</p>
          <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400 tabular-nums leading-none">
            {monthlyStats ? fmt(monthlyStats.totalIncome) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
        </div>

        {/* Expense */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <PremiumIcon icon={ArrowUpRight} tone="red" size="xs" className="mb-2" />
          <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Expense</p>
          <p className="text-lg font-bold text-red-500 dark:text-red-400 tabular-nums leading-none">
            {monthlyStats ? fmt(monthlyStats.totalExpense) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
        </div>

        {/* Savings */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <PremiumIcon icon={PiggyBank} tone={monthlyStats && monthlyStats.savings < 0 ? "orange" : "cyan"} size="xs" className="mb-2" />
          <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Savings</p>
          <p className={cn("text-lg font-bold tabular-nums leading-none",
            monthlyStats && monthlyStats.savings < 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-sky-500 dark:text-sky-400")}>
            {monthlyStats ? fmt(monthlyStats.savings) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">This month</p>
        </div>

        {/* Highest Spender */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <PremiumIcon icon={Trophy} tone="lemon" size="xs" className="mb-2" />
          <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Top Spender</p>
          {monthlyStats?.highestSpenderName ? (
            <>
              <p className="text-sm font-bold text-foreground truncate leading-none">
                {firstName(monthlyStats.highestSpenderName)}
              </p>
              <p className="text-[11px] font-semibold text-red-500 dark:text-red-400 tabular-nums mt-1">
                {fmt(monthlyStats.highestSpenderAmount!)}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-muted-foreground/40 leading-none">—</p>
          )}
        </div>
      </div>
    </>
  );
}
