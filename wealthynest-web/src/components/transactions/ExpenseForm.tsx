"use client";

import {useRef, useState} from "react";
import {Check, Image as ImageIcon, Lock, MapPin, Paperclip, Receipt, Star, Trash2, Users, X} from "lucide-react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {toast} from "sonner";
import {FormInput} from "@/components/forms/FormInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {type ExpenseFormValues, expenseSchema} from "@/features/expenses/schemas/expense.schema";
import type {SplitParticipant} from "@/features/expenses/types/expense.types";
import type {AccountType} from "@/features/accounts/types/account.types";
import {useReceiptAttachment} from "@/features/expenses/hooks/useReceiptAttachment";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {BankLogo} from "@/components/icons/BankLogo";
import {CategoryPicker} from "./CategoryPicker";
import {AccountPicker, accountPickerLabel} from "./AccountPicker";
import {BigAmountInput} from "./BigAmountInput";
import {FormModalHeader} from "./FormModalHeader";
import {cn} from "@/lib/utils";
import {todayLocalISO} from "@/lib/date";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";

// ─── Expense Form ─────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  title:              string;
  defaultValues?:     Partial<ExpenseFormValues>;
  defaultCategoryId?: string;
  categoryOptions:    { value: string; label: string }[];
  cashAccounts:       { id: string; name: string; currentBalance: number }[];
  bankAccounts:       { id: string; name: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  creditAccounts:     { id: string; name: string; bankName?: string; currentBalance: number }[];
  /** clearLocation is true only when editing an expense that HAD a location and the user just
   * removed it — a plain absent latitude/longitude in `v` is otherwise indistinguishable from
   * "the user never touched this field," which a partial update must leave alone. */
  onSubmit:           (v: ExpenseFormValues, splitWith?: SplitParticipant[], clearLocation?: boolean) => void;
  onCancel:           () => void;
  onDelete?:          () => void;
  isPending:          boolean;
  submitLabel:        string;
  /** Pins the account (e.g. opened via a specific card's "Add Expense" action) — shows a locked
   * read-only display instead of the full picker, matching the pattern edit forms already use. */
  lockedAccount?: { id: string; name: string; bankName?: string; accountType: AccountType; currentBalance: number; primary?: boolean };
  /** Other family members this expense can be split with — omitted (or empty) hides the section
   * entirely, which also covers users not currently in a family. */
  familyMembers?: { id: string; fullName: string }[];
  /** The expense's real ID — edit mode only. Enables the receipt-attach section, which is keyed
   * by this ID (useReceiptAttachment/localStorage); create mode has no ID yet, so it's omitted
   * there and receipts stay attachable only after the expense is saved (via the detail drawer). */
  expenseId?: string;
}

export function ExpenseForm({ title, defaultValues, defaultCategoryId, categoryOptions, cashAccounts, bankAccounts, creditAccounts, onSubmit, onCancel, onDelete, isPending, submitLabel, lockedAccount, familyMembers = [], expenseId }: ExpenseFormProps) {
  const hasAccounts = cashAccounts.length > 0 || bankAccounts.length > 0 || creditAccounts.length > 0;
  const primaryBankAccount = bankAccounts.find(a => a.primary);
  const { fmtExact } = useAmountFormatter();

  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { dataUrl: receiptUrl, attach, remove: removeReceipt } = useReceiptAttachment(expenseId);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const toggleParticipant = (id: string) => {
    setSplitWith(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // One flat picker, every account listed — defaults to the primary bank account when creating.
  const defaultAccountId = lockedAccount?.id ?? primaryBankAccount?.id ?? cashAccounts[0]?.id ?? bankAccounts[0]?.id ?? creditAccounts[0]?.id ?? "";

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    // Category defaults to whatever you used last (or most often, if there's no "last") —
    // personalized beats a hardcoded guess, since everyone's top spending category differs.
    defaultValues: { expenseDate: todayLocalISO(), accountId: defaultAccountId, categoryId: defaultCategoryId, ...defaultValues },
  });

  // Opt-in, per-transaction — only ever captured when the user explicitly taps the button below,
  // never automatically. Works in both create and edit (unlike the receipt section above, this
  // doesn't need an expense ID to exist yet).
  const latitude  = form.watch("latitude");
  const longitude = form.watch("longitude");
  const hasLocation = latitude != null && longitude != null;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        form.setValue("latitude", pos.coords.latitude, { shouldDirty: true });
        form.setValue("longitude", pos.coords.longitude, { shouldDirty: true });
        setLocating(false);
      },
      err => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED
          ? "Location permission denied — you can still save the expense without it."
          : "Couldn't get your current location.");
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  const clearLocation = () => {
    form.setValue("latitude", undefined, { shouldDirty: true });
    form.setValue("longitude", undefined, { shouldDirty: true });
  };

  // Instant "insufficient balance" feedback before the round-trip to the server (which enforces
  // the same rule authoritatively). originalAmount gives back this expense's own old amount when
  // editing, so re-saving the same amount against an already-tight balance doesn't false-positive.
  const originalAmount = defaultValues?.amount ?? 0;
  const participantIds = [...splitWith];
  const equalShare = participantIds.length > 0
    ? Math.floor((Number(form.watch("amount") || 0) / (participantIds.length + 1)) * 100) / 100
    : 0;

  const handleValidatedSubmit = (values: ExpenseFormValues) => {
    const account = [...cashAccounts, ...bankAccounts].find(a => a.id === values.accountId);
    if (account) {
      const balanceAfter = account.currentBalance + originalAmount - Number(values.amount);
      if (balanceAfter < 0) {
        form.setError("accountId", { message: `Insufficient balance in ${account.name}.` });
        return;
      }
    }
    const shares: SplitParticipant[] = splitOpen
      ? participantIds
          .map(userId => ({
            userId,
            shareAmount: splitMode === "equal" ? equalShare : Number(customShares[userId] || 0),
          }))
          .filter(s => s.shareAmount > 0)
      : [];
    // The only way latitude goes from present (defaultValues, i.e. an existing saved location) to
    // absent (values, i.e. after the form's own state) is the "Remove location" button below —
    // capturing a NEW location never un-sets it, so this reliably means "explicitly cleared."
    const clearLocation = defaultValues?.latitude != null && values.latitude == null;
    onSubmit(values, shares.length > 0 ? shares : undefined, clearLocation);
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
      <div className="h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
      <div className="p-5">
        <FormModalHeader icon={Receipt} tone="red" size="sm"
          title={title} onDelete={onDelete} onClose={onCancel} />
        <form onSubmit={form.handleSubmit(handleValidatedSubmit)} className="space-y-4">
          <BigAmountInput colorClass="text-red-500 dark:text-red-400" testId="expense-amount-input"
            error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />

          <Controller control={form.control} name="expenseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />

          <Controller control={form.control} name="categoryId" render={({ field, fieldState }) => (
            <CategoryPicker categories={categoryOptions} value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message}
              manageHref="/settings/categories" testId="expense-category-picker" />
          )} />

          <FormInput label="Description (optional)" placeholder="e.g. Lunch at Saravana Bhavan"
            {...form.register("description")} />

          <FormInput label="Notes (optional)" placeholder="Any extra detail worth keeping"
            {...form.register("notes")} />

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Location (optional)</label>
            {hasLocation ? (
              <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground">
                <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                <span className="flex-1 truncate text-xs text-muted-foreground tabular-nums">{latitude?.toFixed(5)}, {longitude?.toFixed(5)}</span>
                <button type="button" onClick={clearLocation} aria-label="Remove location"
                  className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={captureLocation} disabled={locating}
                className="flex items-center gap-2 h-11 px-3 w-full rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors disabled:opacity-60">
                <MapPin className="w-4 h-4" /> {locating ? "Getting location…" : "Add current location"}
              </button>
            )}
          </div>

          {expenseId && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1.5">
                <Paperclip className="w-3.5 h-3.5" /> Receipt (optional)
              </label>
              {receiptUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a browser-local data URL, not a remote/optimizable image */}
                  <img src={receiptUrl} alt="Receipt" className="w-full max-h-40 object-contain rounded-xl border border-border" />
                  <button type="button" onClick={removeReceipt} aria-label="Remove receipt"
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full h-16 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-indigo-500/40 transition-colors">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[11px]">Attach a receipt photo</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ""; }} />
            </div>
          )}

          {lockedAccount ? (
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Paid Via</label>
              <div className="w-full h-11 px-3 rounded-xl border border-border bg-muted/40 flex items-center gap-2.5 text-sm text-foreground">
                <BankLogo name={lockedAccount.bankName} fallbackIcon={ACCOUNT_TYPE_META[lockedAccount.accountType].icon}
                  fallbackHex={ACCOUNT_TYPE_META[lockedAccount.accountType].hex} size="xs" />
                <span className="flex-1 truncate">{accountPickerLabel(lockedAccount)}</span>
                {lockedAccount.primary && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{fmtExact(lockedAccount.currentBalance)}</span>
                <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              </div>
            </div>
          ) : !hasAccounts ? (
            <div className="flex items-start gap-2 bg-amber-500/12 border border-amber-500/20 rounded-xl px-3 py-3">
              <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">No accounts found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You need at least one account to add expenses.{" "}
                  <a href="/accounts" className="underline text-indigo-500">Add an account →</a>
                </p>
              </div>
            </div>
          ) : (
            <Controller control={form.control} name="accountId" render={({ field, fieldState }) => (
              <AccountPicker cashAccounts={cashAccounts} bankAccounts={bankAccounts} creditAccounts={creditAccounts}
                value={field.value} onChange={field.onChange} error={fieldState.error?.message} testId="expense-account-picker" />
            )} />
          )}

          {familyMembers.length > 0 && (
            <div>
              <button type="button" onClick={() => setSplitOpen(v => !v)} data-testid="expense-split-toggle"
                className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
                <Users className="w-3.5 h-3.5" /> {splitOpen ? "Cancel split" : "Split with family"}
              </button>
              {splitOpen && (
                <div className="mt-2 space-y-3 bg-muted/40 border border-border/60 rounded-xl p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {familyMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => toggleParticipant(m.id)}
                        data-testid={`expense-split-participant-${m.id}`}
                        className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                          splitWith.has(m.id)
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-background border-border text-muted-foreground hover:text-foreground")}>
                        {m.fullName}
                      </button>
                    ))}
                  </div>
                  {participantIds.length > 0 && (
                    <>
                      <div className="flex gap-2">
                        {(["equal", "custom"] as const).map(mode => (
                          <button key={mode} type="button" onClick={() => setSplitMode(mode)}
                            data-testid={`expense-split-mode-${mode}`}
                            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                              splitMode === mode
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background border-border text-muted-foreground hover:text-foreground")}>
                            {mode === "equal" ? "Split equally" : "Custom amounts"}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1.5">
                        {participantIds.map(id => {
                          const member = familyMembers.find(m => m.id === id);
                          return (
                            <div key={id} className="flex items-center justify-between text-xs">
                              <span className="text-foreground">{member?.fullName}</span>
                              {splitMode === "equal" ? (
                                <span className="text-muted-foreground tabular-nums">{fmtExact(equalShare)}</span>
                              ) : (
                                <input type="text" inputMode="decimal" placeholder="0.00"
                                  data-testid={`expense-split-custom-share-${id}`}
                                  value={customShares[id] ?? ""}
                                  onChange={e => setCustomShares(prev => ({ ...prev, [id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                                  className="w-24 h-7 px-2 rounded-lg bg-background border border-border text-right text-xs text-foreground outline-none focus:border-indigo-500" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70">
                        Each person&apos;s share becomes an IOU to you, visible on the Family page.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" data-testid="expense-form-submit" disabled={isPending || !hasAccounts}
              className="flex items-center justify-center gap-2 flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-lg shadow-red-500/25 transition-all disabled:opacity-60 disabled:shadow-none">
              <Check className="w-4 h-4" /> {isPending ? "Saving…" : submitLabel}
            </button>
            <button type="button" onClick={onCancel}
              className="h-11 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
