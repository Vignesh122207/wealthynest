"use client";

import {useState} from "react";
import {Minus, Plus} from "lucide-react";
import {useForm} from "react-hook-form";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {resolveGoalIcon} from "@/lib/categoryMeta";
import {useUpdateGoal} from "@/features/goals/hooks/useGoals";
import type {Goal} from "@/features/goals/types/goal.types";
import {cn, formatCurrency} from "@/lib/utils";

export function AddSavingsModal({ goal, goalColor, onClose }: { goal: Goal; goalColor: string; onClose: () => void }) {
  const { mutate: updateGoal, isPending } = useUpdateGoal();
  const [mode, setMode] = useState<"add" | "withdraw">("add");
  const [error, setError] = useState("");
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);

  const form = useForm<{ amount: number | undefined }>({ defaultValues: { amount: undefined } });

  const handleSubmit = ({ amount }: { amount: number | undefined }) => {
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
    <TransactionModalOverlay onDismiss={onClose} maxWidth="max-w-sm">
      <FormModalShell accent={mode === "add" ? "from-emerald-400 to-emerald-600" : "from-red-400 to-red-600"}>
        <FormModalHeader icon={resolveGoalIcon(goal)} hex={goalColor} title={goal.name} onClose={onClose} />
        <p className="text-xs text-muted-foreground -mt-3 mb-4">
          {mode === "add" ? `${formatCurrency(remaining)} remaining` : `${formatCurrency(goal.savedAmount)} available to withdraw`}
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl mb-4">
          <button type="button" data-testid="goal-savings-mode-add" onClick={() => { setMode("add"); setError(""); form.reset(); }}
            className={cn("flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-all",
              mode === "add" ? "bg-emerald-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button type="button" data-testid="goal-savings-mode-withdraw" onClick={() => { setMode("withdraw"); setError(""); form.reset(); }}
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
            data-testid="goal-savings-amount-input"
            {...form.register("amount", { valueAsNumber: true })} />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            {mode === "add" && remaining > 0 && (
              <button type="button" onClick={() => form.setValue("amount", remaining)}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-all whitespace-nowrap">
                Full ({formatCurrency(remaining)})
              </button>
            )}
            <button type="submit" data-testid="goal-savings-submit" disabled={isPending}
              className={cn("flex-1 h-9 rounded-xl text-sm font-medium text-white hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0",
                mode === "add"
                  ? "bg-gradient-to-br from-emerald-700 to-emerald-600 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40"
                  : "bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40")}>
              {isPending ? "Saving…" : mode === "add" ? "Add to Savings" : "Withdraw"}
            </button>
          </div>
        </form>
      </FormModalShell>
    </TransactionModalOverlay>
  );
}
