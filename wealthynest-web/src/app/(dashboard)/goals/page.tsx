"use client";

import {useMemo, useState} from "react";
import {ChevronDown, ChevronUp, Pause, Plus, Target, Trophy} from "lucide-react";
import {Header} from "@/components/layout/Header";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {GOAL_COLORS} from "@/lib/categoryMeta";
import {useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal,} from "@/features/goals/hooks/useGoals";
import type {Goal} from "@/features/goals/types/goal.types";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {type GoalFormValues} from "./_components/goalSchema";
import {AddSavingsModal} from "./_components/AddSavingsModal";
import {GoalCard} from "./_components/GoalCard";
import {GoalForm} from "./_components/GoalForm";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { fmt } = useAmountFormatter();
  const [showCreate,   setShowCreate]   = useState(false);
  const [editGoal,     setEditGoal]     = useState<Goal | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [unlinkGoalId, setUnlinkGoalId] = useState<string | null>(null);
  const [savingsGoal,  setSavingsGoal]  = useState<Goal | null>(null);
  const [showDone,     setShowDone]     = useState(false);
  const [showPaused,   setShowPaused]   = useState(false);

  const { data: goals = [], isLoading, isError, refetch } = useGoals();
  const { mutate: createGoal, isPending: creating } = useCreateGoal();
  const { mutate: updateGoal, isPending: updating } = useUpdateGoal();
  const { mutate: deleteGoal }                      = useDeleteGoal();

  const sorted = useMemo(() => [...goals].sort((a, b) => {
    const aC = a.savedAmount >= a.targetAmount;
    const bC = b.savedAmount >= b.targetAmount;
    if (aC !== bC) return aC ? 1 : -1;
    const aDays = a.targetDate
      ? (new Date(a.targetDate).getTime() - Date.now()) / 86_400_000 : Infinity;
    const bDays = b.targetDate
      ? (new Date(b.targetDate).getTime() - Date.now()) / 86_400_000 : Infinity;
    if (aDays !== bDays) return aDays - bDays;
    const aPct = a.targetAmount > 0 ? a.savedAmount / a.targetAmount : 0;
    const bPct = b.targetAmount > 0 ? b.savedAmount / b.targetAmount : 0;
    return aPct - bPct;
  }), [goals]);

  // Index used to derive each goal's color deterministically (GOAL_COLORS cycled
  // by position in the full unsorted list, matching GoalsSummary's approach),
  // so a goal's color stays stable even as sort order shifts with progress.
  const colorIndex = new Map(goals.map((g, i) => [g.id, i]));
  const colorFor = (g: Goal) => {
    const complete = g.savedAmount >= g.targetAmount;
    return complete ? "#34C759" : GOAL_COLORS[(colorIndex.get(g.id) ?? 0) % GOAL_COLORS.length];
  };

  // Paused-but-incomplete goals get their own section (like Completed Goals' own collapsible
  // section below) instead of sitting inline within Active Goals distinguished only by a small
  // badge — easy to miss in a longer list, and the whole point of pausing is that it's not
  // something you're actively working toward right now.
  const activeGoals    = sorted.filter(g => g.savedAmount < g.targetAmount && !g.paused);
  const pausedGoals    = sorted.filter(g => g.savedAmount < g.targetAmount && g.paused);
  const completedGoals = sorted.filter(g => g.savedAmount >= g.targetAmount);

  const totalTarget    = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.savedAmount,  0);
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const overallPct     = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const onCreateSubmit = (v: GoalFormValues & { accountId?: string; icon?: string }) =>
    createGoal(
      { name: v.name, icon: v.icon, targetAmount: Number(v.targetAmount), savedAmount: Number(v.savedAmount ?? 0), targetDate: v.targetDate || undefined, accountId: v.accountId },
      { onSuccess: () => setShowCreate(false) }
    );

  const onUpdateSubmit = (v: GoalFormValues & { accountId?: string; icon?: string }) => {
    if (!editGoal) return;
    const wasLinked   = !!editGoal.accountId;
    const isUnlinking = wasLinked && !v.accountId;
    updateGoal(
      {
        id: editGoal.id,
        payload: {
          name: v.name, icon: v.icon, targetAmount: Number(v.targetAmount),
          savedAmount: Number(v.savedAmount ?? 0), targetDate: v.targetDate || undefined,
          accountId:     v.accountId  || undefined,
          unlinkAccount: isUnlinking  || undefined,
        },
      },
      { onSuccess: () => setEditGoal(null) }
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <Header title="Goals" subtitle="Save toward what matters, one milestone at a time" />

      {confirmId && (
        <ConfirmDialog open title="Delete Goal"
          description="This goal and all its savings history will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteGoal(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}

      {unlinkGoalId && (
        <ConfirmDialog open title="Unlink Account"
          description="This will stop auto-syncing the goal balance from the account. Your saved amount stays unchanged."
          confirmLabel="Unlink" danger
          onConfirm={() => { updateGoal({ id: unlinkGoalId, payload: { unlinkAccount: true } }); setUnlinkGoalId(null); }}
          onCancel={() => setUnlinkGoalId(null)} />
      )}

      {savingsGoal && <AddSavingsModal goal={savingsGoal} goalColor={colorFor(savingsGoal)} onClose={() => setSavingsGoal(null)} />}

      {showCreate && (
        <GoalForm isCreate goalColor={GOAL_COLORS[goals.length % GOAL_COLORS.length]}
          onSubmit={onCreateSubmit} onCancel={() => setShowCreate(false)} onClose={() => setShowCreate(false)} isPending={creating} />
      )}

      {editGoal && (
        <GoalForm goal={editGoal} goalColor={colorFor(editGoal)}
          onSubmit={onUpdateSubmit} onCancel={() => setEditGoal(null)} onClose={() => setEditGoal(null)} isPending={updating}
          onDelete={() => { setConfirmId(editGoal.id); setEditGoal(null); }}
          onPause={() => updateGoal({ id: editGoal.id, payload: { paused: true } }, { onSuccess: () => setEditGoal(null) })}
          onResume={() => updateGoal({ id: editGoal.id, payload: { paused: false } }, { onSuccess: () => setEditGoal(null) })}
          onUnlink={() => { setUnlinkGoalId(editGoal.id); setEditGoal(null); }}
          pauseResumeDisabled={updating} />
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Summary banner */}
        {goals.length > 0 && (
          <div className="bg-gradient-to-br from-fuchsia-500/15 to-purple-500/10 border border-fuchsia-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Saved</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{fmt(totalSaved)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  of {fmt(totalTarget)} across {goals.length} {goals.length === 1 ? "goal" : "goals"}
                </p>
              </div>
              {totalRemaining > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Still Needed</p>
                  <p className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-400 tabular-nums">{fmt(totalRemaining)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    across {activeGoals.length} active {activeGoals.length === 1 ? "goal" : "goals"}
                  </p>
                </div>
              )}
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                <p className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-400 tabular-nums">{overallPct.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{completedGoals.length} of {goals.length} complete</p>
              </div>
            </div>
            <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
              <div className="h-full bg-fuchsia-500 rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-52 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={() => refetch()} description="Couldn't load your goals. Check your connection and try again." />
        ) : goals.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet"
            description="Set a financial goal — buying a house, emergency fund, or a dream vacation — and track your progress."
            action={
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-gradient-to-br from-fuchsia-600 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30 hover:shadow-xl hover:shadow-fuchsia-500/40 hover:-translate-y-0.5 text-white px-5 h-10 rounded-xl text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" /> Create First Goal
              </button>
            } />
        ) : (
          <>
            {/* Urgency legend */}
            {(activeGoals.length > 0 || pausedGoals.length > 0) && (
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground/50 uppercase tracking-wide text-xs">Urgency:</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> Overdue / &lt;30 days</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> &lt;3 months</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" /> On track</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Completed</span>
              </div>
            )}
            {activeGoals.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <PremiumIcon icon={Target} tone="purple" size="xs" />
                  <h2 className="text-sm font-semibold text-foreground">Active Goals</h2>
                  <span className="text-xs text-muted-foreground">{activeGoals.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activeGoals.map(g => (
                    <GoalCard key={g.id} goal={g} goalColor={colorFor(g)}
                      onEdit={() => { setShowCreate(false); setEditGoal(g); }}
                      onAddSavings={() => setSavingsGoal(g)} />
                  ))}
                </div>
              </section>
            )}

            {pausedGoals.length > 0 && (
              <section>
                <button onClick={() => setShowPaused(v => !v)}
                  className="flex items-center gap-2 mb-3 group w-full">
                  <Pause className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors">
                    Paused Goals
                  </h2>
                  <span className="text-xs text-muted-foreground">{pausedGoals.length}</span>
                  <div className="ml-auto">
                    {showPaused
                      ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {showPaused && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {pausedGoals.map(g => (
                      <GoalCard key={g.id} goal={g} goalColor={colorFor(g)}
                        onEdit={() => { setShowCreate(false); setEditGoal(g); }}
                        onAddSavings={() => setSavingsGoal(g)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {completedGoals.length > 0 && (
              <section>
                <button onClick={() => setShowDone(v => !v)}
                  className="flex items-center gap-2 mb-3 group w-full">
                  <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors">
                    Completed Goals
                  </h2>
                  <span className="text-xs text-muted-foreground">{completedGoals.length}</span>
                  <div className="ml-auto">
                    {showDone
                      ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground" />
                      : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                </button>
                {showDone && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {completedGoals.map(g => (
                      <GoalCard key={g.id} goal={g} goalColor={colorFor(g)}
                        onEdit={() => { setShowCreate(false); setEditGoal(g); }}
                        onAddSavings={() => setSavingsGoal(g)} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
        </div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Target, label: "Add Goal", color: "fuchsia", testId: "fab-add-goal", onClick: () => { setShowCreate(true); setEditGoal(null); } },
      ]} />
    </div>
  );
}
