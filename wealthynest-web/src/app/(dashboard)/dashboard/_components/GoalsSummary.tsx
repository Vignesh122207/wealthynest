"use client";

import Link from "next/link";
import { Trophy, Target } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { getGoalIcon, GOAL_COLORS } from "@/lib/categoryMeta";
import type { Goal } from "@/features/goals/types/goal.types";

interface GoalsSummaryProps {
  goals:     Goal[];
  isLoading: boolean;
}

export function GoalsSummary({ goals, isLoading }: GoalsSummaryProps) {
  const completedGoals = goals.filter(g => g.savedAmount >= g.targetAmount);
  const totalTarget    = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.savedAmount,  0);
  const goalsPct       = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm animate-fade-in-up delay-375">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-foreground">Goals</h3>
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
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-1">
            <Target className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">No goals set up</p>
          <Link href="/goals" className="text-xs text-primary hover:underline">Create a goal →</Link>
        </div>
      ) : (
        <div className="p-5">
          {/* Overall progress */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Overall</span>
                <span className="text-xs font-bold text-primary tabular-nums">
                  {formatCurrency(totalSaved)} / {formatCurrency(totalTarget)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${goalsPct}%`, background: "linear-gradient(90deg, #818cf8, #a78bfa)" }}
                />
              </div>
            </div>
            <span className="text-sm font-bold text-primary tabular-nums shrink-0">
              {goalsPct.toFixed(0)}%
            </span>
          </div>

          {/* Individual goals — each with a unique color */}
          <div className="space-y-3.5">
            {goals.slice(0, 4).map((g, idx) => {
              const pct     = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
              const done    = g.savedAmount >= g.targetAmount;
              const color   = done ? "#34C759" : GOAL_COLORS[idx % GOAL_COLORS.length];
              const IconComp = getGoalIcon(g.name);

              return (
                <div key={g.id} className="flex items-center gap-3">
                  {/* Colored icon badge */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + "20" }}
                  >
                    <IconComp
                      className="w-[18px] h-[18px]"
                      style={{ color }}
                      strokeWidth={1.75}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                      {done
                        ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
                        : <span className="text-xs font-semibold shrink-0 ml-1 tabular-nums" style={{ color }}>
                            {pct.toFixed(0)}%
                          </span>}
                    </div>
                    {/* Progress bar in goal's unique color */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
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
