"use client";

import {useMemo} from "react";
import {Clock, Trophy, Users, Wallet, Zap} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {resolveGoalIcon} from "@/lib/categoryMeta";
import type {Goal} from "@/features/goals/types/goal.types";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";

// ─── Goal Card — whole card clickable to edit, "Add to Savings" stays a distinct action ──

export function GoalCard({ goal, goalColor, onEdit, onAddSavings }: {
  goal:         Goal;
  goalColor:    string;
  onEdit:       () => void;
  onAddSavings: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const pct       = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const complete  = goal.savedAmount >= goal.targetAmount;
  const goalIcon  = resolveGoalIcon(goal);

  const daysLeft = useMemo(() => {
    if (!goal.targetDate || complete) return null;
    return Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86_400_000);
  }, [goal.targetDate, complete]);

  const monthsLeft    = daysLeft != null ? Math.max(1, Math.ceil(daysLeft / 30)) : null;
  // A paused goal shouldn't nudge the user to keep saving toward it — that directly
  // contradicts the pause they just chose.
  const monthlyNeeded = monthsLeft && !complete && !goal.paused && remaining > 0
    ? Math.ceil(remaining / monthsLeft) : null;

  const urgency = complete ? "complete"
    : daysLeft != null && daysLeft < 0  ? "overdue"
    : daysLeft != null && daysLeft < 30 ? "critical"
    : daysLeft != null && daysLeft < 90 ? "warning"
    : "normal";

  const barColor    = pct >= 100 ? "bg-emerald-500"
    : pct >= 60 ? "bg-indigo-500"
    : pct >= 30 ? "bg-amber-500"
    : "bg-red-500";
  const borderClass = urgency === "overdue" ? "border-red-500/30"
    : urgency === "critical" ? "border-amber-500/30"
    : complete ? "border-emerald-500/30" : "border-border";

  return (
    <div data-testid="goal-card" className={cn(
      "bg-card border rounded-2xl shadow-sm overflow-hidden",
      "transition-shadow duration-300 ease-out",
      "has-[button:hover]:shadow-md has-[button:focus-visible]:shadow-md",
      complete ? "border-emerald-500/30 ring-2 ring-emerald-500/20" : borderClass,
      goal.paused && !complete ? "opacity-70 border-border" : "")}>
      <button type="button" onClick={onEdit}
        aria-label={`Edit ${goal.name} goal, ${pct.toFixed(0)}% saved`}
        className="w-full text-left p-5 hover:bg-muted/30 transition-colors duration-200 focus-visible:outline-none focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fuchsia-500/40">
        <div className="flex items-start gap-3 mb-3">
          <PremiumIcon icon={goalIcon} hex={goalColor} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{goal.name}</p>
              {complete && <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
              {goal.shared && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">
                  <Users className="w-2.5 h-2.5" /> Shared
                </span>
              )}
              {goal.paused && !complete && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">PAUSED</span>
              )}
            </div>
            {goal.accountName && (
              <div className="flex items-center gap-1 mt-0.5">
                <Wallet className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate max-w-[160px]">{goal.accountName}</p>
              </div>
            )}
            {goal.targetDate && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-foreground/30" />
                <p className={cn("text-xs font-medium",
                  urgency === "overdue" || urgency === "critical" ? "text-red-600 dark:text-red-400"
                    : urgency === "warning" ? "text-amber-600 dark:text-amber-400"
                    : complete ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/50")}>
                  {complete ? "Goal reached!"
                    : daysLeft != null && daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue`
                    : daysLeft != null ? `${daysLeft}d left · ${formatDate(goal.targetDate)}`
                    : formatDate(goal.targetDate)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <p className="text-lg font-bold tabular-nums text-foreground tracking-tight">{fmt(goal.savedAmount)}</p>
            <p className="text-sm font-medium text-foreground/60 tabular-nums">of {fmt(goal.targetAmount)}</p>
          </div>
          <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]">
            <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground/60 tabular-nums">{pct.toFixed(0)}% complete</p>
            {complete
              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Completed!</span>
              : remaining > 0 && <p className="text-xs font-medium text-foreground/50 tabular-nums">{fmt(remaining)} to go</p>
            }
          </div>
        </div>
      </button>

      {!complete && (
        <div className="px-5 pb-5 -mt-1">
          {monthlyNeeded ? (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs leading-snug text-indigo-700 dark:text-indigo-300">
                Save <span className="font-bold tabular-nums">{fmt(monthlyNeeded)}/month</span> to reach goal on time
              </p>
            </div>
          ) : !goal.targetDate && !goal.paused && remaining > 0 && (
            <div className="flex items-center gap-2 bg-muted/50 border border-border/60 rounded-xl px-3 py-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <p className="text-xs leading-snug text-muted-foreground/80">Set a target date to see your monthly savings plan</p>
            </div>
          )}

          {goal.accountId ? (
            <div className="flex items-center gap-2 bg-indigo-500/[0.07] border border-indigo-500/15 rounded-xl px-3 py-2">
              <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs leading-snug text-indigo-600 dark:text-indigo-400">
                Auto-synced from <span className="font-semibold">{goal.accountName}</span> — add money to that account to update progress
              </p>
            </div>
          ) : (
            <button onClick={onAddSavings}
              className="w-full h-8 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
              <Wallet className="w-3.5 h-3.5" /> Add to Savings
            </button>
          )}
        </div>
      )}
    </div>
  );
}
