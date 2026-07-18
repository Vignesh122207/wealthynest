"use client";

import {useEffect, useRef, useState} from "react";
import {CalendarDays, Check, ChevronDown, Flag, Plus, Power} from "lucide-react";
import {cn} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import {ConfirmDialog} from "@/components/shared/ConfirmDialog";
import {FloatingActionButton} from "@/components/shared/FloatingActionButton";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {DropdownPanel} from "@/components/transactions/DropdownPanel";
import {GOAL_COLORS, resolveGoalIcon} from "@/lib/categoryMeta";
import {useGoals} from "@/features/goals/hooks/useGoals";
import {
    useCreateRecurringGoalContribution,
    useDeleteRecurringGoalContribution,
    useRecurringGoalContribution,
    useToggleRecurringGoalContribution,
    useUpdateRecurringGoalContribution,
} from "@/features/recurringGoalContribution/hooks/useRecurringGoalContribution";
import type {
    RecurringGoalContribution
} from "@/features/recurringGoalContribution/types/recurringGoalContribution.types";
import type {Goal} from "@/features/goals/types/goal.types";

// ─── Day helpers (same semantics as Recurring Income's Credit Day) ─────────────

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dayLabel(day: number) {
  if (day === 0) return "Last working day of every month";
  return `${ordinal(day)} of every month`;
}

function goalColorFor(goal: Goal, index: number) {
  return goal.color ?? GOAL_COLORS[index % GOAL_COLORS.length];
}

// ─── Goal Picker — small, single call site, so no shared component (see AccountPicker/
// CategoryPicker for the general pattern this follows: trigger button + DropdownPanel list) ──

function GoalPicker({ goals, value, onChange }: { goals: Goal[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = goals.findIndex(g => g.id === value);
  const selected = goals[selectedIndex];

  return (
    <div>
      <label className="block text-sm font-medium text-muted-foreground mb-1.5">Goal</label>
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} data-testid="recurring-goal-picker-trigger"
        className="w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all bg-background text-foreground border-border hover:border-indigo-500/50">
        {selected
          ? <PremiumIcon icon={resolveGoalIcon(selected)} hex={goalColorFor(selected, selectedIndex)} size="xs" />
          : <Flag className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected?.name ?? "Select a goal"}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <DropdownPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div className="flex-1 min-h-0 overflow-y-auto" data-testid="recurring-goal-picker-panel">
          {goals.map((g, i) => (
            <button key={g.id} type="button" onClick={() => { onChange(g.id); setOpen(false); }}
              data-testid={`recurring-goal-picker-option-${g.id}`}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                g.id === value ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-muted/60")}>
              <PremiumIcon icon={resolveGoalIcon(g)} hex={goalColorFor(g, i)} size="xs" />
              <span className="flex-1 truncate">{g.name}</span>
            </button>
          ))}
        </div>
      </DropdownPanel>
    </div>
  );
}

// ─── Rule Form Modal ────────────────────────────────────────────────────────

function RuleFormModal({
  initial, goals, onSave, onClose, onDelete, saving,
}: {
  initial?: Partial<RecurringGoalContribution>;
  goals: Goal[];
  onSave: (v: { goalId: string; amount: number; dayOfMonth: number }) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [goalId, setGoalId] = useState(initial?.goalId ?? goals[0]?.id ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [day,    setDay]    = useState(initial?.dayOfMonth?.toString() ?? "0");
  const [dayOpen, setDayOpen] = useState(false);
  const dayTriggerRef = useRef<HTMLButtonElement>(null);

  const isEdit = !!initial?.id;

  // goals can still be loading (empty) the instant this modal mounts — the useState default
  // above only evaluates once, so if useGoals() resolves after mount the picker would otherwise
  // be stuck on no default forever. Sync once goals arrive, but only for a fresh rule and only
  // if nothing's been picked yet.
  useEffect(() => {
    if (!isEdit && !goalId && goals[0]?.id) setGoalId(goals[0].id);
  }, [goals, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid  = goalId && Number(amount) > 0 && Number(day) >= 0 && Number(day) <= 31;

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
        <div className="h-1.5 bg-gradient-to-r from-indigo-400 to-violet-500" />
        <div className="p-5">
          <FormModalHeader icon={Flag} tone="indigo"
            title={isEdit ? "Edit Rule" : "Add Recurring Contribution"} onDelete={onDelete} onClose={onClose} />
          <p className="text-xs text-muted-foreground -mt-3 mb-4">Auto-adds to a goal&apos;s saved amount every month</p>

          <div className="space-y-4">
            <BigAmountInput label="Monthly Contribution" colorClass="text-indigo-500 dark:text-indigo-400"
              testId="recurring-goal-amount-input"
              inputProps={{
                value: amount,
                onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")),
              }} />

            <GoalPicker goals={goals} value={goalId} onChange={setGoalId} />

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contribution Day</label>
              <button type="button" ref={dayTriggerRef} onClick={() => setDayOpen(v => !v)}
                className="w-full h-11 px-3 rounded-xl border flex items-center gap-2.5 text-sm text-left transition-all bg-background text-foreground border-border hover:border-indigo-500/50">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{dayLabel(Number(day))}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground/60 shrink-0 transition-transform", dayOpen && "rotate-180")} />
              </button>
              <DropdownPanel anchorRef={dayTriggerRef} open={dayOpen} onClose={() => setDayOpen(false)}>
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
                  <button type="button" onClick={() => { setDay("0"); setDayOpen(false); }}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors mb-2",
                      day === "0" ? "bg-indigo-500 text-white" : "bg-muted/60 text-foreground hover:bg-muted")}>
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    Last working day of every month
                  </button>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <button key={d} type="button" onClick={() => { setDay(String(d)); setDayOpen(false); }}
                        className={cn("aspect-square rounded-lg text-xs font-medium tabular-nums transition-colors",
                          String(d) === day ? "bg-indigo-500 text-white" : "text-foreground hover:bg-muted",
                          d > 28 && String(d) !== day && "text-muted-foreground/50")}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </DropdownPanel>
              {Number(day) === 0 && (
                <p className="text-[10px] text-indigo-500/70 mt-1">e.g. if month ends Saturday, contributes on Friday</p>
              )}
              {Number(day) > 28 && Number(day) !== 0 && (
                <p className="text-[10px] text-amber-500/80 mt-1">
                  Contributes on last day of months shorter than {day} days
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => valid && onSave({ goalId, amount: Number(amount), dayOfMonth: Number(day) })}
                type="button" disabled={saving || !valid} data-testid="recurring-goal-form-submit"
                className="flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
              </button>
              <button onClick={onClose} type="button"
                className="h-11 px-5 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </TransactionModalOverlay>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule, onEdit, onToggle, toggling,
}: {
  rule:     RecurringGoalContribution;
  onEdit:   () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const { fmt } = useAmountFormatter();
  const icon = resolveGoalIcon({ name: rule.goalName, icon: rule.goalIcon });

  return (
    <div onClick={onEdit} role="button" tabIndex={0} data-testid="recurring-goal-rule-card"
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(); } }}
      aria-label={`Edit ${rule.goalName} recurring contribution`}
      className={cn(
      "bg-card border rounded-2xl p-4 transition-all cursor-pointer hover:border-indigo-500/40 hover:shadow-sm hover:-translate-y-0.5 duration-200",
      rule.active ? "border-border" : "border-border opacity-60"
    )}>
      <div className="flex items-start gap-3">
        <PremiumIcon icon={icon} hex={rule.goalColor ?? GOAL_COLORS[0]} size="md" className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{rule.goalName}</p>
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
              rule.active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}>
              {rule.active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">
            {fmt(rule.amount)}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ month</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {dayLabel(rule.dayOfMonth)}
            </span>
          </div>
        </div>

        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onToggle} disabled={toggling}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              rule.active
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-muted"
            )}
            title={rule.active ? "Pause" : "Resume"}>
            <Power className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

type ModalState = null | "create" | RecurringGoalContribution;

export function GoalsTab() {
  const { fmt } = useAmountFormatter();
  const [modal,    setModal]    = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rules = [], isLoading }              = useRecurringGoalContribution();
  const { data: goals = [] }                         = useGoals();
  const { mutate: createRule, isPending: creating }  = useCreateRecurringGoalContribution();
  const { mutate: updateRule, isPending: updating }  = useUpdateRecurringGoalContribution();
  const { mutate: toggleRule, isPending: toggling }  = useToggleRecurringGoalContribution();
  const { mutate: deleteRule, isPending: deleting }  = useDeleteRecurringGoalContribution();

  const deletingRule = rules.find(r => r.id === deleteId);
  const isEdit       = modal !== null && modal !== "create";
  const isSaving     = isEdit ? updating : creating;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Add a rule to bump a goal&apos;s saved amount by a fixed sum every month.
      </p>

      {goals.length === 0 ? (
        <div className="flex items-start gap-2 bg-amber-500/12 border border-amber-500/20 rounded-xl px-3 py-3">
          <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">No goals found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You need at least one goal before setting up an auto-contribution.{" "}
              <a href="/goals" className="underline text-indigo-500">Create a goal →</a>
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
            <Flag className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-foreground">No recurring contributions</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Add a rule to auto-fund a goal by a fixed amount every month.
          </p>
          <button onClick={() => setModal("create")}
            className="mt-4 flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-all">
            <Plus className="w-4 h-4" /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              toggling={toggling}
              onEdit={() => setModal(rule)}
              onToggle={() => toggleRule(rule.id)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <RuleFormModal
          initial={modal === "create" ? undefined : modal}
          goals={goals}
          saving={isSaving}
          onClose={() => setModal(null)}
          onSave={v => {
            if (isEdit) {
              updateRule(
                { id: (modal as RecurringGoalContribution).id, payload: v },
                { onSuccess: () => setModal(null) }
              );
            } else {
              createRule(v, { onSuccess: () => setModal(null) });
            }
          }}
          onDelete={isEdit ? () => { setDeleteId((modal as RecurringGoalContribution).id); setModal(null); } : undefined}
        />
      )}

      {deleteId && deletingRule && (
        <ConfirmDialog open title="Delete this rule?"
          description={`The auto-contribution to ${deletingRule.goalName} (${fmt(deletingRule.amount)}/month) will stop.`}
          confirmLabel={deleting ? "Deleting…" : "Delete Rule"} danger
          onConfirm={() => deleteRule(deleteId, { onSuccess: () => setDeleteId(null) })}
          onCancel={() => setDeleteId(null)} />
      )}

      {goals.length > 0 && (
        <FloatingActionButton actions={[
          { icon: Flag, label: "Add Recurring Contribution", color: "indigo", onClick: () => setModal("create"), testId: "fab-add-recurring-goal" },
        ]} />
      )}
    </>
  );
}
