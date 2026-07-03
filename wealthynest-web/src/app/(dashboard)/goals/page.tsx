"use client";

import { useState, useMemo } from "react";
import {
  Plus, Target, Trash2, Pencil, X, Check, ChevronDown, ChevronUp,
  Wallet, Clock, Trophy, Zap, Minus, Pause, Play, Unlink, AlertTriangle,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TableRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { FormInput } from "@/components/forms/FormInput";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import {
  useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
} from "@/features/goals/hooks/useGoals";
import { useAccounts } from "@/features/accounts/hooks/useAccounts";
import type { Goal } from "@/features/goals/types/goal.types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

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

// ─── Color Picker ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#10b981", "#14b8a6", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [custom, setCustom] = useState(
    value && !PRESET_COLORS.includes(value) ? value : ""
  );

  const applyCustom = (hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">Colour</label>
      <div className="flex items-center gap-2 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button key={c} type="button" onClick={() => { onChange(c); setCustom(""); }}
            style={{ background: c }}
            className={cn(
              "w-7 h-7 rounded-full transition-all shrink-0",
              value === c ? "ring-2 ring-offset-2 ring-offset-card ring-white/70 scale-110" : "opacity-80 hover:opacity-100 hover:scale-110",
            )} />
        ))}
        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-7 h-7 rounded-full border border-border shrink-0"
            style={{ background: custom && /^#[0-9a-fA-F]{6}$/.test(custom) ? custom : "transparent" }} />
          <input
            value={custom}
            onChange={e => { setCustom(e.target.value); applyCustom(e.target.value); }}
            placeholder="#hex"
            maxLength={7}
            className="w-20 h-7 px-2 rounded-lg text-xs bg-muted/60 border border-border text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Emoji Picker ─────────────────────────────────────────────────────────────

const EMOJI_GRID = [
  "🎯","💰","🏠","🚗","✈️","📚","💻","🏥","💍","🌴",
  "🎓","🛒","💪","🎸","⛵","🐕","📈","🏋️","🌱","❤️",
];

function extractFirstEmoji(str: string): string {
  // Use spread to get Unicode-aware characters, find the first non-ASCII one
  const chars = [...str];
  return chars.find(c => c.codePointAt(0)! > 127) ?? "";
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [custom, setCustom] = useState("");

  const preview = extractFirstEmoji(custom);

  const applyCustom = () => {
    if (preview) { onChange(preview); setOpen(false); setCustom(""); }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={cn(
          "w-10 h-10 rounded-xl bg-muted/60 border text-xl flex items-center justify-center transition-all shrink-0",
          open ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500"
        )}>
        {value || "🎯"}
      </button>

      {open && (
        <div className="p-3 bg-muted/40 border border-border rounded-2xl space-y-3">
          <div className="grid grid-cols-10 gap-1">
            {EMOJI_GRID.map(e => (
              <button key={e} type="button" onClick={() => { onChange(e); setOpen(false); }}
                className={cn("w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-card transition-all",
                  value === e ? "bg-indigo-600/20 ring-1 ring-indigo-500/40" : "")}>
                {e}
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-2.5 space-y-2">
            <p className="text-[11px] text-muted-foreground">Or paste an emoji from your keyboard</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-lg shrink-0">
                {preview || <span className="text-muted-foreground/40 text-xs">?</span>}
              </div>
              <input
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="Paste emoji here…"
                className="flex-1 h-8 px-2 rounded-lg text-sm bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyCustom(); } }}
              />
              <button type="button" onClick={applyCustom} disabled={!preview}
                className="h-8 px-2.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-all disabled:opacity-40 shrink-0">
                OK
              </button>
            </div>
            {custom && !preview && (
              <p className="text-[11px] text-amber-500">That doesn&apos;t look like an emoji — try pasting one directly.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add / Withdraw Savings Modal ─────────────────────────────────────────────

function AddSavingsModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{goal.icon || "🎯"}</span>
              <h3 className="font-semibold text-foreground text-sm">{goal.name}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "add" ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(goal.savedAmount)} available to withdraw`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

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
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete, onAddSavings, onPause, onResume, onUnlink }: {
  goal:         Goal;
  onEdit:       () => void;
  onDelete:     () => void;
  onAddSavings: () => void;
  onPause:      () => void;
  onResume:     () => void;
  onUnlink:     () => void;
}) {
  const pct       = goal.targetAmount > 0 ? Math.min(100, (goal.savedAmount / goal.targetAmount) * 100) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const complete  = goal.savedAmount >= goal.targetAmount;

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

  const goalColor   = goal.color || PRESET_COLORS[7];
  const barColor    = pct >= 100 ? "bg-emerald-500"
    : pct >= 60 ? "bg-indigo-500"
    : pct >= 30 ? "bg-amber-500"
    : "bg-red-500";
  const borderClass = urgency === "overdue" ? "border-red-500/30"
    : urgency === "critical" ? "border-amber-500/30"
    : complete ? "border-emerald-500/30" : "border-border";

  return (
    <div className={cn("bg-card border rounded-2xl p-5 transition-all group shadow-sm",
      complete ? "border-emerald-500/30 ring-2 ring-emerald-500/20" : borderClass,
      goal.paused && !complete ? "opacity-70 border-slate-600" : "")}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{goal.icon || "🎯"}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: goalColor }} />
              <p className="text-sm font-semibold text-foreground truncate">{goal.name}</p>
              {complete && <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
              {goal.paused && !complete && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 shrink-0">PAUSED</span>
              )}
            </div>
            {goal.accountName && (
              <div className="flex items-center gap-1 mt-0.5">
                <Wallet className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">{goal.accountName}</p>
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
        <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!complete && (goal.paused
            ? <button onClick={onResume} title="Resume goal" className="w-7 h-7 rounded-lg text-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10 flex items-center justify-center transition-all"><Play className="w-3.5 h-3.5" /></button>
            : <button onClick={onPause} title="Pause goal" className="w-7 h-7 rounded-lg text-foreground/40 hover:text-amber-400 hover:bg-amber-500/10 flex items-center justify-center transition-all"><Pause className="w-3.5 h-3.5" /></button>
          )}
          {goal.accountId && (
            <button onClick={onUnlink} title="Unlink account" className="w-7 h-7 rounded-lg text-foreground/40 hover:text-indigo-400 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit}
            className="w-7 h-7 rounded-lg text-foreground/40 hover:text-indigo-400 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(goal.savedAmount)}</p>
          <p className="text-sm font-medium text-foreground/60 tabular-nums">of {formatCurrency(goal.targetAmount)}</p>
        </div>
        <div className="h-2 bg-foreground/[0.08] rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", barColor ?? "")}
            style={{ width: `${pct}%`, ...(!barColor ? { background: goalColor } : {}) }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground/60">{pct.toFixed(0)}% complete</p>
          {complete
            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">✓ Completed!</span>
            : remaining > 0 && <p className="text-xs font-medium text-foreground/50 tabular-nums">{formatCurrency(remaining)} to go</p>
          }
        </div>
      </div>

      {!complete && (
        <>
          {monthlyNeeded ? (
            <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-400 dark:text-indigo-300">
                Save <span className="font-bold">{formatCurrency(monthlyNeeded)}/month</span> to reach goal on time
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
        </>
      )}
    </div>
  );
}

// ─── Goal Form ────────────────────────────────────────────────────────────────

function GoalForm({ title, defaultValues, onSubmit, onCancel, isPending, isCreate }: {
  title:         string;
  defaultValues?: Partial<GoalFormValues & { icon?: string; color?: string; accountId?: string }>;
  onSubmit:      (v: GoalFormValues & { icon?: string; color?: string; accountId?: string }) => void;
  onCancel:      () => void;
  isPending:     boolean;
  isCreate?:     boolean;
}) {
  const [icon,      setIcon]      = useState(defaultValues?.icon ?? "🎯");
  const [color,     setColor]     = useState(defaultValues?.color ?? PRESET_COLORS[7]); // indigo default
  const [accountId, setAccountId] = useState(defaultValues?.accountId ?? "");
  const { data: accounts = [] } = useAccounts();
  const savingsAccounts = accounts.filter(a => a.accountType !== "CREDIT_CARD");

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: "", targetAmount: undefined as any, savedAmount: undefined as any, ...defaultValues },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(v => onSubmit({ ...v, icon, color, accountId: accountId || undefined }))} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Goal Name</label>
          <div className="flex items-start gap-2">
            <EmojiPicker value={icon} onChange={setIcon} />
            <input
              placeholder="e.g. Emergency Fund"
              className="flex-1 h-10 px-3 rounded-xl bg-muted/60 border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 transition-colors"
              {...form.register("name")}
            />
          </div>
          {form.formState.errors.name && (
            <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormCurrencyInput label="Target Amount" placeholder="0"
            error={form.formState.errors.targetAmount?.message} {...form.register("targetAmount")} />
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
        </div>
        <Controller control={form.control} name="targetDate" render={({ field, fieldState }) => (
          <FormDatePicker label="Target Date (optional)" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} placeholder="No deadline" />
        )} />

        <ColorPicker value={color} onChange={setColor} />

        {/* Account Link */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Link to Account <span className="text-muted-foreground/50">(optional — auto-syncs progress)</span>
          </label>
          <select
            value={accountId}
            onChange={e => {
              const id = e.target.value;
              setAccountId(id);
              if (id) {
                const acc = savingsAccounts.find(a => a.id === id);
                if (acc) form.setValue("savedAmount", acc.currentBalance, { shouldValidate: true });
              } else {
                form.setValue("savedAmount", undefined as any, { shouldValidate: false });
              }
            }}
            className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-slate-700/60 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors">
            <option value="" style={{ backgroundColor: "#1e293b", color: "#f1f5f9" }}>No linked account</option>
            {savingsAccounts.map(a => (
              <option key={a.id} value={a.id} style={{ backgroundColor: "#1e293b", color: "#f1f5f9" }}>
                {a.name} — {formatCurrency(a.currentBalance)}
              </option>
            ))}
          </select>
          {accountId && (form.getValues("savedAmount") ?? 0) > 0 && !defaultValues?.accountId && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              ⚠ Linking this account will replace your manually entered saved amount with the account&apos;s current balance.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : "Save Goal"}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const [showCreate,   setShowCreate]   = useState(false);
  const [editGoal,     setEditGoal]     = useState<Goal | null>(null);
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [unlinkGoalId, setUnlinkGoalId] = useState<string | null>(null);
  const [savingsGoal,  setSavingsGoal]  = useState<Goal | null>(null);
  const [showDone,     setShowDone]     = useState(false);

  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts = [] }         = useAccounts();
  const { mutate: createGoal, isPending: creating } = useCreateGoal();
  const { mutate: updateGoal, isPending: updating } = useUpdateGoal();
  const { mutate: deleteGoal }                      = useDeleteGoal();

  const efAccount = accounts.find(a => a.accountType === "EMERGENCY_FUND");
  const efGoal    = goals.find(g => g.name.toLowerCase().includes("emergency"));
  const showEfWarning = !!(efAccount && efGoal && efGoal.accountId !== efAccount.id);

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

  const activeGoals    = sorted.filter(g => g.savedAmount < g.targetAmount);
  const completedGoals = sorted.filter(g => g.savedAmount >= g.targetAmount);

  const totalTarget    = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved     = goals.reduce((s, g) => s + g.savedAmount,  0);
  const totalRemaining = Math.max(0, totalTarget - totalSaved);
  const overallPct     = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const onCreateSubmit = (v: GoalFormValues & { icon?: string; color?: string; accountId?: string }) =>
    createGoal(
      { name: v.name, icon: v.icon, color: v.color, targetAmount: Number(v.targetAmount), savedAmount: Number(v.savedAmount ?? 0), targetDate: v.targetDate || undefined, accountId: v.accountId },
      { onSuccess: () => setShowCreate(false) }
    );

  const onUpdateSubmit = (v: GoalFormValues & { icon?: string; color?: string; accountId?: string }) => {
    if (!editGoal) return;
    const wasLinked   = !!editGoal.accountId;
    const isUnlinking = wasLinked && !v.accountId;
    updateGoal(
      {
        id: editGoal.id,
        payload: {
          name: v.name, icon: v.icon, color: v.color, targetAmount: Number(v.targetAmount),
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
      <Header title="Goals" />

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

      {savingsGoal && <AddSavingsModal goal={savingsGoal} onClose={() => setSavingsGoal(null)} />}

      {(showCreate || editGoal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowCreate(false); setEditGoal(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {showCreate && (
              <GoalForm title="New Goal" isCreate
                onSubmit={onCreateSubmit} onCancel={() => setShowCreate(false)} isPending={creating} />
            )}
            {editGoal && (
              <GoalForm title={`Edit — ${editGoal.name}`}
                defaultValues={{
                  name: editGoal.name, targetAmount: editGoal.targetAmount,
                  savedAmount: editGoal.savedAmount, targetDate: editGoal.targetDate ?? "",
                  icon: editGoal.icon, color: editGoal.color, accountId: editGoal.accountId,
                }}
                onSubmit={onUpdateSubmit} onCancel={() => setEditGoal(null)} isPending={updating} />
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Summary banner */}
        {goals.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-600/15 to-violet-600/10 border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Saved</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(totalSaved)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  of {formatCurrency(totalTarget)} across {goals.length} {goals.length === 1 ? "goal" : "goals"}
                </p>
              </div>
              {totalRemaining > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Still Needed</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(totalRemaining)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    across {activeGoals.length} active {activeGoals.length === 1 ? "goal" : "goals"}
                  </p>
                </div>
              )}
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{overallPct.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">{completedGoals.length} of {goals.length} complete</p>
              </div>
            </div>
            <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${overallPct}%` }} />
            </div>
          </div>
        )}

        {/* Emergency fund double-count warning */}
        {showEfWarning && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">Possible double count</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have an <span className="font-medium">Emergency Fund account</span> and an <span className="font-medium">{efGoal!.name}</span> goal linked to a different account. Both may be counting the same money toward your net worth. Consider deleting the Emergency Fund account and linking your goal to your actual savings account instead.
              </p>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-end">
          <button onClick={() => { setShowCreate(v => !v); setEditGoal(null); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 h-10 rounded-xl text-sm font-medium transition-all">
            <Plus className="w-4 h-4" /> New Goal
          </button>
        </div>

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
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 h-10 rounded-xl text-sm font-medium transition-all">
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
                  <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-sm font-semibold text-foreground">Active Goals</h2>
                  <span className="text-xs text-muted-foreground">{activeGoals.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activeGoals.map(g => (
                    <GoalCard key={g.id} goal={g}
                      onEdit={() => { setShowCreate(false); setEditGoal(g); }}
                      onDelete={() => setConfirmId(g.id)}
                      onAddSavings={() => setSavingsGoal(g)}
                      onPause={() => updateGoal({ id: g.id, payload: { paused: true } })}
                      onResume={() => updateGoal({ id: g.id, payload: { paused: false } })}
                      onUnlink={() => setUnlinkGoalId(g.id)} />
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
                      <GoalCard key={g.id} goal={g}
                        onEdit={() => { setShowCreate(false); setEditGoal(g); }}
                        onDelete={() => setConfirmId(g.id)}
                        onAddSavings={() => setSavingsGoal(g)}
                        onPause={() => {}}
                        onResume={() => {}}
                        onUnlink={() => setUnlinkGoalId(g.id)} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
}
