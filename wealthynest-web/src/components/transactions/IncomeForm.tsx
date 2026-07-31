"use client";

import {useState} from "react";
import {Check, RefreshCw, Wallet} from "lucide-react";
import {Controller, useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {cn} from "@/lib/utils";
import {todayLocalISO} from "@/lib/date";
import {FormInput} from "@/components/forms/FormInput";
import {FormDatePicker} from "@/components/forms/FormDatePicker";
import {incomeSchema} from "@/features/income/schemas/income.schema";
import {INCOME_SOURCES} from "@/lib/constants";
import {INCOME_ICON_MAP} from "@/lib/categoryMeta";
import {sortByUsage} from "@/lib/mostUsed";
import type {Category} from "@/features/categories/types/category.types";
import {CategoryPicker} from "./CategoryPicker";
import {AccountPicker} from "./AccountPicker";
import {BigAmountInput} from "./BigAmountInput";
import {FormModalHeader} from "./FormModalHeader";

// ─── Income Form ──────────────────────────────────────────────────────────────

// Reuses the shared income schema's source enum as the single source of truth for valid
// IncomeSource values; period fields are omitted here since this form derives them from
// incomeDate instead of collecting them separately (see handleAddIncome/handleUpdateIncome).
export const incomeFormSchema = z.object({
  source:      incomeSchema.shape.source,
  amount:      z.coerce.number().positive("Amount must be positive"),
  incomeDate:  z.string().min(1, "Date is required"),
  accountId:   z.string().min(1, "Select a deposit account"),
  description: z.string().optional(),
});
export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
export type IncomeSourceValue = IncomeFormValues["source"];

/** Maps income category name → IncomeSource enum value stored in DB */
const CATEGORY_NAME_TO_SOURCE: Record<string, IncomeSourceValue> = {
  "salary":          "SALARY",
  "freelance":       "FREELANCE",
  "business":        "BUSINESS",
  "business income": "BUSINESS",
  "rental":          "RENTAL",
  "rental income":   "RENTAL",
  "bonus":           "BONUS",
  "interest":        "INTEREST",
  "interest income": "INTEREST",
  "dividend":        "DIVIDEND",
  "dividend income": "DIVIDEND",
  "other":           "OTHER",
  "other income":    "OTHER",
};

function categoryToSource(name: string): IncomeSourceValue {
  return CATEGORY_NAME_TO_SOURCE[name.toLowerCase().trim()] ?? "OTHER";
}

export function IncomeForm({ onSubmit, onCancel, onDelete, isPending, accounts, incomeCategories, defaultValues, defaultSource, sourceUsageCounts, isEdit, showRecurringOption }: {
  /** recurring is only ever populated when showRecurringOption is set and the toggle is on. */
  onSubmit:          (v: IncomeFormValues, recurring?: { dayOfMonth: number }) => void;
  onCancel:          () => void;
  onDelete?:         () => void;
  isPending:         boolean;
  accounts:          { id: string; name: string; accountType: string; bankName?: string; currentBalance: number; primary?: boolean }[];
  incomeCategories?: Category[];
  defaultValues?:    Partial<IncomeFormValues>;
  defaultSource?:    IncomeSourceValue;
  /** How often each source has been used before — sorts the picker most-used first (e.g. Salary at top). */
  sourceUsageCounts?: Map<string, number>;
  isEdit?:           boolean;
  /** Offers a "repeat monthly" toggle that auto-creates a recurring income rule alongside this
   * one-off entry — only meaningful (and only shown) when adding, not editing. */
  showRecurringOption?: boolean;
}) {
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringDay,  setRecurringDay]  = useState("1");
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    // Defaults to whichever source you logged most recently (or most often, absent that) —
    // Salary only kicks in as a last resort, since it's the one source most people do have.
    defaultValues: { incomeDate: todayLocalISO(), source: defaultSource, ...defaultValues },
  });
  // Deposits can't go to a credit card — split the rest by type so AccountPicker gets its icons right.
  const depositCash = accounts.filter(a => a.accountType === "CASH_WALLET");
  const depositBank = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const hasDepositAccounts = depositCash.length > 0 || depositBank.length > 0;

  const hasCategoryOptions = incomeCategories && incomeCategories.length > 0;
  // Real Category records when we have them (so names/colors follow whatever the user set up
  // in Settings), otherwise the fixed INCOME_SOURCES list. Both resolve to the same
  // IncomeSourceValue underneath, and INCOME_ICON_MAP (keyed by that value, not by name) gives
  // every source a correct, distinct icon either way — getCategoryMeta's expense-oriented
  // keyword matching doesn't know what to do with "Dividend" or "Freelance".
  const unsortedSourceOptions = hasCategoryOptions
    ? incomeCategories!.map(cat => ({ value: categoryToSource(cat.name), label: cat.name }))
    : INCOME_SOURCES.map(s => ({ value: s.value, label: s.label }));
  // Most-used source first (e.g. Salary at the top) so the common case is a single tap away.
  const sourceOptions = sourceUsageCounts
    ? sortByUsage(unsortedSourceOptions, o => o.value, sourceUsageCounts)
    : unsortedSourceOptions;
  const sourceIconFor = (opt: { value: string; label: string }) => INCOME_ICON_MAP[opt.value] ?? INCOME_ICON_MAP.OTHER;

  const handleValidatedSubmit = (values: IncomeFormValues) => {
    onSubmit(values, showRecurringOption && makeRecurring ? { dayOfMonth: Number(recurringDay) } : undefined);
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-border shadow-2xl animate-scale-in bg-card">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />
      <div className="p-5">
        <FormModalHeader icon={Wallet} tone="emerald"
          title={isEdit ? "Edit Income" : "Add Income"} onDelete={onDelete} onClose={onCancel} />
        <form onSubmit={form.handleSubmit(handleValidatedSubmit)} className="space-y-4">
          <BigAmountInput colorClass="text-emerald-500 dark:text-emerald-400" testId="income-amount-input"
            error={form.formState.errors.amount?.message} inputProps={form.register("amount")} />

          <Controller control={form.control} name="incomeDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />

          <Controller control={form.control} name="source" render={({ field, fieldState }) => (
            <CategoryPicker label={hasCategoryOptions ? "Category" : "Source"} placeholder="Select source"
              categories={sourceOptions} value={field.value ?? ""} onChange={field.onChange}
              error={fieldState.error?.message} iconFor={sourceIconFor}
              manageHref={hasCategoryOptions ? "/settings/categories" : undefined} testId="income-source-picker" />
          )} />

          {!hasDepositAccounts ? (
            <div className="text-xs text-amber-500/80 bg-amber-500/12 border border-amber-500/20 rounded-xl px-3 py-2.5">
              No deposit accounts found. Add a Bank Account or Cash Wallet first.
            </div>
          ) : (
            <Controller control={form.control} name="accountId" render={({ field, fieldState }) => (
              <AccountPicker label="Deposit to Account" cashAccounts={depositCash} bankAccounts={depositBank} creditAccounts={[]}
                value={field.value ?? ""} onChange={field.onChange} error={fieldState.error?.message} testId="income-account-picker" />
            )} />
          )}
          <FormInput label="Description (optional)" placeholder="e.g. June salary" {...form.register("description")} />

          {showRecurringOption && (
            <div className={cn("rounded-xl border transition-all",
              makeRecurring ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/30")}>
              <button type="button" onClick={() => setMakeRecurring(v => !v)}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                <RefreshCw className={cn("w-4 h-4 shrink-0 transition-colors", makeRecurring ? "text-emerald-500" : "text-muted-foreground/50")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Repeat monthly</p>
                  <p className="text-xs text-muted-foreground leading-snug">Auto-credit this income on a fixed day every month</p>
                </div>
                <div className={cn("w-9 h-5 rounded-full transition-all shrink-0 relative", makeRecurring ? "bg-emerald-600" : "bg-muted")}>
                  <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", makeRecurring ? "left-4" : "left-0.5")} />
                </div>
              </button>
              {makeRecurring && (
                <div className="px-3.5 pb-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Credit day</p>
                  <select value={recurringDay} onChange={e => setRecurringDay(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl text-xs bg-background border border-border text-foreground outline-none focus:border-emerald-500 transition-all">
                    <option value="0">Last Working Day (nearest Mon–Fri to month-end)</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d)}>
                        {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of every month
                        {d > 28 ? " (short months use last day)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" data-testid="income-form-submit" disabled={isPending}
              className="flex items-center justify-center gap-2 flex-1 h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-60 disabled:shadow-none">
              <Check className="w-4 h-4" /> {isPending ? "Saving…" : isEdit ? "Save Changes" : makeRecurring ? "Add & Set Recurring" : "Add Income"}
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
