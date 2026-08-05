"use client";

import {useRef, useState} from "react";
import {Check, Flag, Pause, Play, Unlink} from "lucide-react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {FormCurrencyInput} from "@/components/forms/FormCurrencyInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {Button} from "@/components/ui/Button";
import {FormModalShell} from "@/components/ui/FormModalShell";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {AccountPicker} from "@/components/transactions/AccountPicker";
import {FormModalHeader} from "@/components/transactions/FormModalHeader";
import {TransactionModalOverlay} from "@/components/transactions/TransactionModalOverlay";
import {BigAmountInput} from "@/components/transactions/BigAmountInput";
import {GOAL_COLORS, GOAL_ICON_OPTIONS, GOAL_PRESETS, resolveGoalIcon} from "@/lib/categoryMeta";
import {useAccounts} from "@/features/accounts/hooks/useAccounts";
import {useAuthStore} from "@/features/auth/store/auth.store";
import type {Goal} from "@/features/goals/types/goal.types";
import {cn} from "@/lib/utils";
import {type GoalFormValues, goalSchema} from "./goalSchema";

// ─── Goal Form ────────────────────────────────────────────────────────────────

export function GoalForm({ goal, goalColor, isCreate, onSubmit, onCancel, onClose, isPending, onDelete, onPause, onResume, onUnlink, pauseResumeDisabled }: {
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
  const { user } = useAuthStore();
  const inFamily = !!user?.familyId;
  // Credit cards aren't a sensible savings-goal destination — Bank Accounts (which now includes
  // any Emergency-Fund-purpose-tagged accounts, purpose being just a tag) and Cash Wallets are.
  const cashAccounts = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts = accounts.filter(a => a.accountType === "BANK_ACCOUNT");

  const form = useForm<GoalFormValues>({
    // Rebuilt fresh each render from the current accountId state — zodResolver reads whichever
    // resolver was most recently passed at validate time, so this stays in sync as the user
    // links/unlinks an account without needing a manual re-validate trigger.
    resolver: zodResolver(goalSchema(!!accountId)),
    defaultValues: {
      name: goal?.name ?? "", targetAmount: goal?.targetAmount ?? undefined,
      savedAmount: goal?.savedAmount ?? undefined, targetDate: goal?.targetDate ?? "",
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
          {isCreate && inFamily && (
            <p className="text-xs text-muted-foreground -mt-3 mb-4">
              Since you&apos;re in a family group, this goal will be shared — every member can see it and add to its progress.
            </p>
          )}

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
                  data-testid="goal-name-input"
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

            <BigAmountInput label="Target Amount" colorClass="text-fuchsia-500 dark:text-fuchsia-400" testId="goal-target-amount-input"
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
                testId="goal-account-picker"
                value={accountId}
                onChange={id => {
                  setAccountId(id);
                  const acc = [...cashAccounts, ...bankAccounts].find(a => a.id === id);
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
              <Button type="submit" data-testid="goal-form-submit" variant="gradient" loading={isPending}
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
