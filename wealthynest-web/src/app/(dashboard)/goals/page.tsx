"use client";

import { useState, useMemo, useRef } from "react";
import {
  Plus, Target, Check, ChevronDown, ChevronUp,
  Wallet, Clock, Trophy, Zap, Minus, Pause, Play, Unlink, Flag,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { Button } from "@/components/ui/Button";
import { FormModalShell } from "@/components/ui/Modal";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { AccountPicker } from "@/components/transactions/AccountPicker";
import { FormModalHeader } from "@/components/transactions/FormModalHeader";
import { TransactionModalOverlay } from "@/components/transactions/TransactionModalOverlay";
import { BigAmountInput } from "@/components/transactions/BigAmountInput";
import { resolveGoalIcon, GOAL_COLORS, GOAL_PRESETS, GOAL_ICON_OPTIONS } from "@/lib/categoryMeta";
import {
  useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
} from "@/features/goals/hooks/useGoals";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import type { Goal } from "@/features/goals/types/goal.types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useAmountFormatter } from "@/hooks/useAmountFormatter";

// ─── Schema ───────────────────────────────────────────────────────────────────

const goalSchema = z.object({
  name:         z.string().min(1, "Name is required").max(100),
  targetAmount: z.coerce.number().positive("Must be a positive amount"),
  savedAmount:  z.coerce.number().min(0, "Cannot be negative").default(0),
  targetDate:   z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.savedAmount > 0 && v.savedAmount > v.targetAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Saved amount cannot exceed the target amount", path: ["savedAmount"] });
  }
});
type GoalFormValues = z.infer<typeof goalSchema>;

// ─── Add / Withdraw Savings Modal ─────────────────────────────────────────────

function AddSavingsModal({ goal, goalColor, onClose }: { goal: Goal; goalColor: string; onClose: () => void }) {
  const { mutate: updateGoal, isPending } = useUpdateGoal();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [error, setError] = useState("");
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);

  const form = useForm<{ amount: number }>({ defaultValues: { amount: undefined as any } });

  const handleSubmit = ({ amount }: { amount: number }) => {
    const n = Number(amount);
    if (!n || n <= 0) { setError("Enter an amount greater than zero."); return; }
    if (mode === "withdraw" && n > goal.savedAmount) {
      setError(`Cannot withdraw more than ${formatCurrency(goal.savedAmount)} saved.`);
      return;
    }
    setError("");
    const newSaved = mode === "add"
      ? Math.min(goal.targetAmount, goal.savedAmount + n)
      : Math.max(0, goal.savedAmount - n);
    updateGoal({ id: goal.id, payload: { savedAmount: newSaved } }, { onSuccess: onClose });
  };

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <FormModalHeader icon={resolveGoalIcon(goal)} hex={goalColor} title={goal.name} onClose={onClose} />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          {mode === "add" ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(goal.savedAmount)} available to withdraw`}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl mb-4">
          <button type="button" onClick={() => { setMode("add"); setError(""); form.reset(); }}
            className={cn("flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all",
              mode === "add" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button type="button" onClick={() => { setMode("withdraw"); setError(""); form.reset(); }}
            className={cn("flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all",
              mode === "withdraw" ? "bg-red-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Minus className="w-3.5 h-3.5" /> Withdraw
          </button>
        </div>

        <div className="mb-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${Math.min(100, (goal.savedAmount / goal.targetAmount) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(goal.savedAmount)} of {formatCurrency(goal.targetAmount)}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <FormCurrencyInput label={mode === "add" ? "Amount to add" : "Amount to withdraw"} placeholder="0"
            {...form.register("amount", { valueAsNumber: true })} />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            {mode === "add" && remaining > 0 && (
              <button type="button" onClick={() => form.setValue("amount", remaining)}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-all whitespace-nowrap">
                Full ({formatCurrency(remaining)})
              </button>
            )}
            <button type="submit" disabled={isPending}
              className={cn("flex-1 h-9 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60",
                mode === "add" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500")}>
              {isPending ? "Saving…" : mode === "add" ? "Add to Savings" : "Withdraw"}
            </button>
          </div>
        </form>
      </div>
    </TransactionModalOverlay>
  );
}

// ─── Goal Card — whole card clickable to edit, "Add to Savings" stays a distinct action ──

function GoalCard({ goal, goalColor, onEdit, onAddSavings }: {
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
  const monthlyNeeded = monthsLeft && !complete && remaining > 0
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
    <div className={cn("bg-card border rounded-2xl transition-all shadow-sm overflow-hidden",
      complete ? "border-emerald-500/30 ring-2 ring-emerald-500/20" : borderClass,
      goal.paused && !complete ? "opacity-70 border-slate-600" : "")}>
      <button type="button" onClick={onEdit}
        aria-label={`Edit ${goal.name} goal, ${pct.toFixed(0)}% saved`}
        className="w-full text-left p-5 hover:bg-muted/30 transition-colors">
        <div className="flex items-start gap-3 mb-3">
          <PremiumIcon icon={goalIcon} hex={goalColor} size="md" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{goal.name}</p>
              {complete && <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
              {goal.paused && !complete && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 shrink-0">PAUSED</span>
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
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold tabular-nums text-foreground">{fmt(goal.savedAmount)}</p>
            <p className="text-sm font-medium text-foreground/60 tabular-nums">of {fmt(goal.targetAmount)}</p>
          </div>
          <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground/60">{pct.toFixed(0)}% complete</p>
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
            <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-400 dark:text-indigo-300">
                Save <span className="font-bold">{fmt(monthlyNeeded)}/month</span> to reach goal on time
              </p>
            </div>
          ) : !goal.targetDate && remaining > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-xl px-3 py-2 mb-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              <p className="text-xs text-muted-foreground/80">Set a target date to see your monthly savings plan</p>
            </div>
          )}

          {goal.accountId ? (
            <div className="flex items-center gap-1.5 bg-indigo-500/8 border border-indigo-500/20 rounded-xl px-3 py-2">
              <Wallet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                Auto-synced from <span className="font-semibold">{goal.accountName}</span> — add money to that account to update progress
              </p>
            </div>
          ) : (
            <button onClick={onAddSavings}
              className="w-full h-8 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Add to Savings
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Goal Form ────────────────────────────────────────────────────────────────

function GoalForm({ goal, goalColor, isCreate, onSubmit, onCancel, onClose, isPending, onDelete, onPause, onResume, onUnlink, pauseResumeDisabled }: {
  goal?:                Goal;
  goalColor:            string;
  isCreate?:            boolean;
  onSubmit:             (v: GoalFormValues & { accountId?: string; icon?: string }) => void;
  onCancel:             () => void;
  onClose:              () => void;
  isPending:            boolean;
  onDelete?:            () => void;
  onPause?:             () => void;
  onResume?:            () => void;
  onUnlink?:            () => void;
  pauseResumeDisabled?: boolean;
}) {
  const [accountId, setAccountId] = useState(goal?.accountId ?? "");
  const [customIcon, setCustomIcon] = useState<string | undefined>(goal?.icon ?? undefined);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const { data: accounts = [] } = useAccounts();
  // Credit cards aren't a sensible savings-goal destination; Emergency Fund
  // accounts very much are (it's one of the goal presets) and were part of the
  // original "any account except credit card" set, so keep those linkable too.
  const cashAccounts          = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts          = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const emergencyFundAccounts = accounts.filter(a => a.accountType === "EMERGENCY_FUND");

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: goal?.name ?? "", targetAmount: goal?.targetAmount as any ?? undefined,
      savedAmount: goal?.savedAmount as any ?? undefined, targetDate: goal?.targetDate ?? "",
    },
  });
  const watchedName = form.watch("name");
  const livePreviewIcon  = resolveGoalIcon({ name: watchedName || "", icon: customIcon });
  const complete = goal ? goal.savedAmount >= goal.targetAmount : false;
  const { ref: nameRhfRef, ...nameFieldRest } = form.register("name");

  return (
    <TransactionModalOverlay onDismiss={onClose}>
      <FormModalShell accent="from-fuchsia-400 to-purple-500">
          <FormModalHeader icon={Flag} tone="purple" title={goal ? `Edit — ${goal.name}` : "New Goal"} onDelete={onDelete} onClose={onClose} />

          {isCreate && (
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Quick start</p>
              <div className="grid grid-cols-5 gap-2">
                {GOAL_PRESETS.map((p, i) => {
                  const isCustom = p.name === "Custom Goal";
                  const isActive = isCustom
                    ? !GOAL_PRESETS.some(x => x.name !== "Custom Goal" && x.name === watchedName)
                    : watchedName === p.name;
                  return (
                    <button key={p.name} type="button"
                      onClick={() => {
                        if (isCustom) {
                          form.setValue("name", "", { shouldValidate: false });
                          nameInputRef.current?.focus();
                        } else {
                          form.setValue("name", p.name, { shouldValidate: true });
                        }
                      }}
                      className={cn("flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all",
                        isActive ? "bg-fuchsia-500/15 ring-1 ring-fuchsia-500/40" : "hover:bg-muted/60")}>
                      <PremiumIcon icon={p.icon} hex={GOAL_COLORS[i % GOAL_COLORS.length]} size="sm" />
                      <span className="text-[9px] text-muted-foreground text-center leading-tight">{isCustom ? "Custom" : p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={form.handleSubmit(v => onSubmit({ ...v, accountId: accountId || undefined, icon: customIcon }))} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Goal Name</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowIconPicker(v => !v)} title="Change icon"
                  className="shrink-0 rounded-2xl transition-all hover:ring-2 hover:ring-fuchsia-500/40">
                  <PremiumIcon icon={livePreviewIcon} hex={goalColor} size="sm" />
                </button>
                <input
                  ref={(el) => { nameInputRef.current = el; nameRhfRef(el); }}
                  placeholder="e.g. Emergency Fund"
                  className="flex-1 h-10 px-3 rounded-xl bg-muted/60 border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-fuchsia-500 transition-colors"
                  {...nameFieldRest}
                />
              </div>
              {form.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
              )}
              {showIconPicker && (
                <div className="mt-2 p-3 bg-muted/40 border border-border rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Choose an icon</p>
                    {customIcon && (
                      <button type="button" onClick={() => setCustomIcon(undefined)}
                        className="text-[11px] text-fuchsia-600 dark:text-fuchsia-400 hover:underline">
                        Use automatic
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_ICON_OPTIONS.map(({ key, icon }) => (
                      <button key={key} type="button" onClick={() => setCustomIcon(key)}
                        className={cn("rounded-lg transition-all", customIcon === key ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-card" : "opacity-70 hover:opacity-100")}>
                        <PremiumIcon icon={icon} hex={goalColor} size="xs" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <BigAmountInput label="Target Amount" colorClass="text-fuchsia-500 dark:text-fuchsia-400"
              error={form.formState.errors.targetAmount?.message} inputProps={form.register("targetAmount")} />

            <div>
              <FormCurrencyInput
                label={isCreate ? "Amount Already Saved" : "Saved Amount"}
                placeholder="0"
                disabled={!!accountId}
                error={form.formState.errors.savedAmount?.message} {...form.register("savedAmount")} />
              {accountId
                ? <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Auto-synced from linked account</p>
                : isCreate && (
                  <p className="text-xs text-muted-foreground/80 mt-1">Or link an account below to auto-sync</p>
                )}
            </div>

            <Controller control={form.control} name="targetDate" render={({ field, fieldState }) => (
              <FormDatePicker label="Target Date (optional)" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="No deadline" />
            )} />

            {/* Account Link */}
            <div>
              <AccountPicker label="Link to Account (optional — auto-syncs progress)"
                cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={[]}
                emergencyFundAccounts={emergencyFundAccounts}
                value={accountId}
                onChange={id => {
                  setAccountId(id);
                  const acc = [...cashAccounts, ...bankAccounts, ...emergencyFundAccounts].find(a => a.id === id);
                  if (acc) form.setValue("savedAmount", acc.currentBalance, { shouldValidate: true });
                }} />
              {accountId && accountId !== goal?.accountId && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                  Linking this account will replace your manually entered saved amount with the account&apos;s current balance.
                </p>
              )}
            </div>

            {/* Pause / Unlink — only meaningful once a goal exists */}
            {goal && !complete && (onPause || onResume || onUnlink) && (
              <div className="flex gap-2 flex-wrap pt-1">
                {goal.paused
                  ? onResume && (
                    <button type="button" onClick={onResume} disabled={pauseResumeDisabled}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-50">
                      <Play className="w-3.5 h-3.5" /> Resume Goal
                    </button>
                  )
                  : onPause && (
                    <button type="button" onClick={onPause} disabled={pauseResumeDisabled}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all disabled:opacity-50">
                      <Pause className="w-3.5 h-3.5" /> Pause Goal
                    </button>
                  )}
                {goal.accountId && onUnlink && (
                  <button type="button" onClick={onUnlink}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-all">
                    <Unlink className="w-3.5 h-3.5" /> Unlink Account
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="gradient" loading={isPending}
                className="flex-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 shadow-fuchsia-500/25 disabled:shadow-none">
                <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Goal"}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
          </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { fmt } = useAmountFormatter();
  const [showCreate,   setShowCreate]   = useState(false);
  const [editGoal,     setEditGoal]     = useState<Goal | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [unlinkGoalId, setUnlinkGoalId] = useState<string | null>(null);
  const [savingsGoal,  setSavingsGoal]  = useState<Goal | null>(null);
  const [showDone,     setShowDone]     = useState(false);

  const { data: goals = [], isLoading } = useGoals();
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

  const activeGoals    = sorted.filter(g => g.savedAmount < g.targetAmount);
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
        ) : goals.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet"
            description="Set a financial goal — buying a house, emergency fund, or a dream vacation — and track your progress."
            action={
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-5 h-10 rounded-xl text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" /> Create First Goal
              </button>
            } />
        ) : (
          <>
            {/* Urgency legend */}
            {activeGoals.length > 0 && (
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
        { icon: Target, label: "Add Goal", color: "fuchsia", onClick: () => { setShowCreate(true); setEditGoal(null); } },
      ]} />
    </div>
  );
}
