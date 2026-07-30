"use client";

import Link from "next/link";
import {Target, Trophy} from "lucide-react";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {GOAL_COLORS, resolveGoalIcon} from "@/lib/categoryMeta";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {EmptyState} from "@/components/shared/EmptyState";
import type {Goal} from "@/features/goals/types/goal.types";

interface GoalsSummaryProps {
  goals:     Goal[];
  isLoading: boolean;
}

export function GoalsSummary({ goals, isLoading }: GoalsSummaryProps) {
  const { fmt } = useAmountFormatter();
  const completedGoals = goals.filter(g => g.savedAmount >= g.targetAmount);
  const totalTarget    = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.savedAmount,  0);
  const goalsPct       = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm animate-fade-in-up delay-375 card-hover">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-foreground">Goals</h2>
          {goals.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {goals.length} total
              </span>
              {completedGoals.length > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {completedGoals.length} done
                </span>
              )}
            </div>
          )}
        </div>
        <Link href="/goals" className="text-xs font-semibold text-primary hover:underline transition-colors">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded shimmer" />
                <div className="h-1.5 w-full rounded-full shimmer" />
              </div>
              <div className="h-3.5 w-10 rounded shimmer" />
            </div>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals set up"
          description="Create a savings goal to start tracking progress toward it."
          action={<Link href="/goals" className="text-xs font-semibold text-primary hover:underline">Create a goal →</Link>}
        />
      ) : (
        <div className="p-5">
          {/* Overall progress */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Overall</span>
                <span className="text-xs font-bold text-primary tabular-nums">
                  {fmt(totalSaved)} / {fmt(totalTarget)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-primary"
                  style={{ width: `${goalsPct}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums shrink-0">
              {goalsPct.toFixed(0)}%
            </span>
          </div>

          {/* Individual goals — ringed icon + target date */}
          <div className="divide-y divide-border/40">
            {goals.slice(0, 4).map((g, idx) => {
              const pct      = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
              const done     = g.savedAmount >= g.targetAmount;
              const color    = done ? "#34C759" : GOAL_COLORS[idx % GOAL_COLORS.length];
              const IconComp = resolveGoalIcon(g);
              const r        = 18;
              const c        = 2 * Math.PI * r;
              const offset   = c - (pct / 100) * c;

              return (
                <div key={g.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Ring progress with icon centered */}
                  <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }} aria-hidden>
                      <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={4} />
                      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
                        strokeDasharray={c} strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 1s ease" }} />
                    </svg>
                    <PremiumIcon icon={IconComp} hex={color} size="xs" className="absolute" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                      {done && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums mt-0.5 truncate">
                      {fmt(g.savedAmount)} of {fmt(g.targetAmount)} · {pct.toFixed(0)}%
                    </p>
                  </div>

                  <div className="text-[11px] text-muted-foreground/80 text-right shrink-0 ml-2 whitespace-nowrap">
                    {g.targetDate
                      ? new Date(g.targetDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                      : "No date"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
