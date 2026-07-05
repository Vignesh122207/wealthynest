"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Receipt, Trash2, Search, ChevronLeft, ChevronRight,
  Banknote, Building2, CreditCard, Pencil, X, Check, Download, ChevronDown, RefreshCw,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  Briefcase, Laptop, Home, Gift, Percent, Coins, TrendingUp, type LucideIcon,
} from "lucide-react";
import { getCategoryMeta } from "@/lib/categoryMeta";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableRowSkeleton } from "@/components/shared/LoadingSkeleton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import {
  useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense,
} from "@/features/expenses/hooks/useExpenses";
import { useCategories } from "@/features/categories/hooks/useCategories";
import {
  useAccounts, useTransfers, useTransfer, useUpdateTransfer, useDeleteTransfer,
} from "@/features/accounts/hooks/useAccounts";
import {
  useIncome, useCreateIncome, useUpdateIncome, useDeleteIncome,
} from "@/features/income/hooks/useIncome";
import { expenseSchema, type ExpenseFormValues } from "@/features/expenses/schemas/expense.schema";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import { usePrefsStore, CURRENCIES } from "@/store/preferences.store";
import { useDebounce } from "@/hooks/useDebounce";
import { INCOME_SOURCES, INCOME_SOURCE_ICONS } from "@/lib/constants";
import type { Category } from "@/features/categories/types/category.types";
import type { Expense } from "@/features/expenses/types/expense.types";
import type { IncomeEntry } from "@/features/income/types/income.types";
import type { AccountTransfer } from "@/features/accounts/types/account.types";

type TxType  = "expenses" | "income" | "transfers" | "all";
type DateMode = "month" | "year" | "custom" | "all";
type SortKey  = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type Channel  = "" | "CASH" | "ACCOUNT" | "CREDIT";

function pad(n: number) { return String(n).padStart(2, "0"); }
function monthLabel(year: number, month: number) {
  return new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const INCOME_ICON_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  SALARY:    { icon: Briefcase,   color: "#34C759" },
  FREELANCE: { icon: Laptop,      color: "#007AFF" },
  BUSINESS:  { icon: Building2,   color: "#BF5AF2" },
  RENTAL:    { icon: Home,        color: "#30B0C7" },
  BONUS:     { icon: Gift,        color: "#FF9500" },
  INTEREST:  { icon: Percent,     color: "#5AC8FA" },
  DIVIDEND:  { icon: TrendingUp,  color: "#32D74B" },
  OTHER:     { icon: Coins,       color: "#8E8E93" },
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(
  expenses: Expense[],
  label: string,
  accountNameMap: Record<string, string>,
  accountTypeMap: Record<string, string>,
) {
  const storedCurr = (() => { try { return JSON.parse(localStorage.getItem("wn-preferences") ?? "{}")?.state?.currency ?? "INR"; } catch { return "INR"; } })();
  const headerSymbol = ({ INR: "₹", USD: "$", EUR: "€", GBP: "£" } as Record<string,string>)[storedCurr] ?? storedCurr;
  const header = ["Date", "Description", "Category", `Amount (${headerSymbol})`, "Account", "Payment Method"];
  const rows = expenses.map(e => {
    let paymentMethod = e.paymentMethod ?? "";
    if (!paymentMethod && e.accountId) {
      const type = accountTypeMap[e.accountId];
      if      (type === "CASH_WALLET")   paymentMethod = "Cash";
      else if (type === "CREDIT_CARD")   paymentMethod = "Credit Card";
      else if (type === "BANK_ACCOUNT")  paymentMethod = "Bank Account";
    }
    return [
      e.expenseDate,
      `"${(e.description ?? "").replace(/"/g, '""')}"`,
      `"${(e.categoryName ?? "").replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      `"${accountNameMap[e.accountId ?? ""] ?? ""}"`,
      paymentMethod,
    ];
  });
  const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `expenses-${label}.csv` });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportIncomeCsv(entries: import("@/features/income/types/income.types").IncomeEntry[], label: string, accountNames: Record<string, string>) {
  const INCOME_SOURCE_LABELS: Record<string, string> = {
    SALARY: "Salary", FREELANCE: "Freelance", BUSINESS: "Business",
    RENTAL: "Rental Income", INTEREST: "Interest", DIVIDEND: "Dividend",
    GIFT: "Gift", BONUS: "Bonus", OTHER: "Other",
  };
  const header = ["Date", "Source", "Amount (₹)", "Description", "Account"];
  const rows = entries.map(e => [
    e.incomeDate,
    INCOME_SOURCE_LABELS[e.source] ?? e.source.replace(/_/g, " "),
    e.amount.toFixed(2),
    `"${(e.description ?? "").replace(/"/g, '""')}"`,
    `"${accountNames[e.accountId ?? ""] ?? ""}"`,
  ]);
  const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `income-${label}.csv` });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportTransfersCsv(transfers: import("@/features/accounts/types/account.types").AccountTransfer[], label: string) {
  const header = ["Date", "From Account", "To Account", "Amount (₹)", "Description"];
  const rows = transfers.map(t => [
    t.transferDate, t.fromAccountName, t.toAccountName,
    t.amount.toFixed(2),
    `"${(t.description ?? "").replace(/"/g, '""')}"`,
  ]);
  const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `transfers-${label}.csv` });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Expense Form ─────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  title:           string;
  defaultValues?:  Partial<ExpenseFormValues>;
  categoryOptions: { value: string; label: string }[];
  cashAccounts:    { id: string; name: string; currentBalance: number }[];
  bankAccounts:    { id: string; name: string; bankName?: string; currentBalance: number }[];
  creditAccounts:  { id: string; name: string; bankName?: string; currentBalance: number }[];
  onSubmit:        (v: ExpenseFormValues) => void;
  onCancel:        () => void;
  isPending:       boolean;
  submitLabel:     string;
}

function ExpenseForm({ title, defaultValues, categoryOptions, cashAccounts, bankAccounts, creditAccounts, onSubmit, onCancel, isPending, submitLabel }: ExpenseFormProps) {
  const hasAccounts = cashAccounts.length > 0 || bankAccounts.length > 0 || creditAccounts.length > 0;

  const detectChannel = (): "" | "CASH" | "ACCOUNT" | "CREDIT" => {
    if (defaultValues?.accountId) {
      if (cashAccounts.some(a => a.id === defaultValues.accountId))   return "CASH";
      if (creditAccounts.some(a => a.id === defaultValues.accountId)) return "CREDIT";
      return "ACCOUNT";
    }
    const types = [cashAccounts.length > 0, bankAccounts.length > 0, creditAccounts.length > 0].filter(Boolean);
    if (types.length === 1) {
      if (cashAccounts.length > 0)   return "CASH";
      if (creditAccounts.length > 0) return "CREDIT";
      return "ACCOUNT";
    }
    return "";
  };
  const [payChannel, setPayChannel] = useState<"" | "CASH" | "ACCOUNT" | "CREDIT">(detectChannel);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { expenseDate: new Date().toISOString().split("T")[0], ...defaultValues },
  });

  useEffect(() => {
    if (!defaultValues?.accountId) {
      const ch = detectChannel();
      if (ch !== "") {
        const list = ch === "CASH" ? cashAccounts : ch === "CREDIT" ? creditAccounts : bankAccounts;
        if (list.length === 1) form.setValue("accountId", list[0].id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountOptions =
    payChannel === "CASH"    ? cashAccounts.map(a => ({ value: a.id, label: `${a.name} — ${formatCurrencyCompact(a.currentBalance)}` }))
    : payChannel === "CREDIT" ? creditAccounts.map(a => ({ value: a.id, label: `${a.name}${a.bankName ? ` (${a.bankName})` : ""} — ${formatCurrencyCompact(a.currentBalance)} due` }))
    : bankAccounts.map(a => ({ value: a.id, label: `${a.name}${a.bankName ? ` (${a.bankName})` : ""} — ${formatCurrencyCompact(a.currentBalance)}` }));

  const handleChannelChange = (ch: "CASH" | "ACCOUNT" | "CREDIT") => {
    setPayChannel(ch);
    const list = ch === "CASH" ? cashAccounts : ch === "CREDIT" ? creditAccounts : bankAccounts;
    form.setValue("accountId", list.length === 1 ? list[0].id : "");
    form.clearErrors("accountId");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FormCurrencyInput label="Amount" placeholder="0"
            error={form.formState.errors.amount?.message} {...form.register("amount")} />
          <Controller control={form.control} name="expenseDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
          <FormSelect label="Category" options={categoryOptions} placeholder="Select category"
            error={form.formState.errors.categoryId?.message} {...form.register("categoryId")} />
          <FormInput label="Description (optional)" placeholder="e.g. Lunch at Saravana Bhavan"
            className="sm:col-span-2 lg:col-span-3" {...form.register("description")} />
        </div>

        {!hasAccounts ? (
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
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground">Paid Via</p>
              <span className="text-red-500 text-xs ml-0.5">*</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {cashAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannelChange("CASH")}
                  className={cn("flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "CASH"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  <Banknote className="w-3.5 h-3.5" /> Cash
                </button>
              )}
              {bankAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannelChange("ACCOUNT")}
                  className={cn("flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "ACCOUNT"
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  <Building2 className="w-3.5 h-3.5" /> Bank Account
                </button>
              )}
              {creditAccounts.length > 0 && (
                <button type="button" onClick={() => handleChannelChange("CREDIT")}
                  className={cn("flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all border",
                    payChannel === "CREDIT"
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  <CreditCard className="w-3.5 h-3.5" /> Credit Card
                </button>
              )}
            </div>
            {payChannel !== "" && accountOptions.length > 1 && (
              <FormSelect
                label={payChannel === "CASH" ? "Cash Wallet" : payChannel === "CREDIT" ? "Credit Card" : "Bank Account"}
                options={accountOptions} placeholder="Select account"
                error={form.formState.errors.accountId?.message} {...form.register("accountId")} />
            )}
            {form.formState.errors.accountId && payChannel === "" && (
              <p className="text-xs text-red-500">Please select how this expense was paid</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending || !hasAccounts}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : submitLabel}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Income Form ──────────────────────────────────────────────────────────────

const incomeFormSchema = z.object({
  source:      z.string().min(1, "Select a source"),
  amount:      z.string().min(1, "Amount is required"),
  incomeDate:  z.string().min(1, "Date is required"),
  accountId:   z.string().min(1, "Select a deposit account"),
  description: z.string().optional(),
});
type IncomeFormValues = z.infer<typeof incomeFormSchema>;

/** Maps income category name → IncomeSource enum value stored in DB */
const CATEGORY_NAME_TO_SOURCE: Record<string, string> = {
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

function categoryToSource(name: string): string {
  return CATEGORY_NAME_TO_SOURCE[name.toLowerCase().trim()] ?? "OTHER";
}

/** Maps stored IncomeSource back to the income category name for pre-selection */
const SOURCE_TO_CATEGORY_NAME: Record<string, string> = {
  SALARY:    "Salary",
  FREELANCE: "Freelance",
  BUSINESS:  "Business Income",
  RENTAL:    "Rental Income",
  BONUS:     "Bonus",
  INTEREST:  "Interest",
  DIVIDEND:  "Dividend",
  OTHER:     "Other",
};

function IncomeForm({ onSubmit, onCancel, isPending, accounts, incomeCategories, defaultValues, isEdit }: {
  onSubmit:          (v: IncomeFormValues) => void;
  onCancel:          () => void;
  isPending:         boolean;
  accounts:          { id: string; name: string; accountType: string }[];
  incomeCategories?: Category[];
  defaultValues?:    Partial<IncomeFormValues>;
  isEdit?:           boolean;
}) {
  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: { incomeDate: new Date().toISOString().split("T")[0], ...defaultValues },
  });
  const depositAccounts = accounts.filter(a => a.accountType !== "CREDIT_CARD");
  const accountOptions  = depositAccounts.map(a => ({ value: a.id, label: a.name }));
  const selectedSource  = form.watch("source");

  const hasCategoryOptions = incomeCategories && incomeCategories.length > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{isEdit ? "Edit Income" : "Add Income"}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <FormCurrencyInput label="Amount" placeholder="0"
            error={form.formState.errors.amount?.message} {...form.register("amount")} />
          <Controller control={form.control} name="incomeDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
        </div>

        {/* Income category / source selection */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {hasCategoryOptions ? "Category" : "Source"}
          </label>
          {hasCategoryOptions ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {incomeCategories!.map(cat => {
                const src = categoryToSource(cat.name);
                const isActive = selectedSource === src ||
                  (isEdit && SOURCE_TO_CATEGORY_NAME[selectedSource ?? ""] === cat.name);
                return (
                  <button key={cat.id} type="button"
                    onClick={() => form.setValue("source", src, { shouldValidate: true })}
                    className={cn(
                      "flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium border transition-all text-left",
                      isActive
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted/60 border-border text-muted-foreground hover:text-foreground"
                    )}
                    style={isActive ? { backgroundColor: (cat.color ?? "#22c55e") + "20" } : undefined}>
                    {cat.icon && cat.icon.length <= 4 && (
                      <span className="shrink-0">{cat.icon}</span>
                    )}
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INCOME_SOURCES.map(s => (
                <button key={s.value} type="button"
                  onClick={() => form.setValue("source", s.value, { shouldValidate: true })}
                  className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                    selectedSource === s.value
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  <span>{INCOME_SOURCE_ICONS[s.value]}</span> {s.label}
                </button>
              ))}
            </div>
          )}
          {form.formState.errors.source && (
            <p className="text-xs text-red-500 mt-1">{form.formState.errors.source.message}</p>
          )}
        </div>

        {accountOptions.length === 0 ? (
          <div className="text-xs text-amber-500/80 bg-amber-500/12 border border-amber-500/20 rounded-xl px-3 py-2.5">
            No deposit accounts found. Add a Bank Account or Cash Wallet first.
          </div>
        ) : (
          <FormSelect label="Deposit to Account" options={accountOptions}
            placeholder="Select account"
            error={form.formState.errors.accountId?.message}
            {...form.register("accountId")} />
        )}
        <FormInput label="Description (optional)" placeholder="e.g. June salary" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Income"}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Transfer Form ────────────────────────────────────────────────────────────

const transferFormSchema = z.object({
  fromAccountId: z.string().min(1, "Select source account"),
  toAccountId:   z.string().min(1, "Select destination account"),
  amount:        z.string().min(1, "Amount is required"),
  transferDate:  z.string().min(1, "Date is required"),
  description:   z.string().optional(),
});
type TransferFormValues = z.infer<typeof transferFormSchema>;

function TransferFormModal({ onSubmit, onCancel, isPending, accounts, editTransferRef, isEdit }: {
  onSubmit:         (v: TransferFormValues) => void;
  onCancel:         () => void;
  isPending:        boolean;
  accounts:         { id: string; name: string }[];
  editTransferRef?: AccountTransfer;
  isEdit?:          boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: editTransferRef?.fromAccountId ?? "",
      toAccountId:   editTransferRef?.toAccountId   ?? "",
      amount:        editTransferRef ? String(editTransferRef.amount) : "",
      transferDate:  editTransferRef?.transferDate   ?? today,
      description:   editTransferRef?.description   ?? "",
    },
  });
  const fromId   = form.watch("fromAccountId");
  const toOpts   = accounts.filter(a => a.id !== fromId).map(a => ({ value: a.id, label: a.name }));
  const fromOpts = accounts.map(a => ({ value: a.id, label: a.name }));

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground text-sm">{isEdit ? "Edit Transfer" : "New Transfer"}</h3>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isEdit && editTransferRef ? (
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2.5 text-sm">
            <span className="font-medium text-foreground">{editTransferRef.fromAccountName}</span>
            <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
            <span className="font-medium text-foreground">{editTransferRef.toAccountName}</span>
            <span className="ml-auto text-xs text-muted-foreground/50">accounts can't be changed</span>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <FormSelect label="From Account" options={fromOpts} placeholder="Select account"
              error={form.formState.errors.fromAccountId?.message} {...form.register("fromAccountId")} />
            <FormSelect label="To Account" options={toOpts} placeholder="Select account"
              error={form.formState.errors.toAccountId?.message} {...form.register("toAccountId")} />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <FormCurrencyInput label="Amount" placeholder="0"
            error={form.formState.errors.amount?.message} {...form.register("amount")} />
          <Controller control={form.control} name="transferDate" render={({ field, fieldState }) => (
            <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
          )} />
        </div>
        <FormInput label="Description (optional)" placeholder="e.g. Monthly savings" {...form.register("description")} />
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending}
            className="flex items-center justify-center gap-2 flex-1 h-10 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-60">
            <Check className="w-4 h-4" /> {isPending ? "Saving…" : isEdit ? "Save Changes" : "Transfer"}
          </button>
          <button type="button" onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Row Components ───────────────────────────────────────────────────────────

function ExpenseRow({ expense, accountName, onEdit, onDelete }: {
  expense:     Expense;
  accountName: string | undefined;
  onEdit:      () => void;
  onDelete:    () => void;
}) {
  const catMeta  = getCategoryMeta(expense.categoryName ?? "");
  const catColor = expense.categoryColor ?? catMeta.color;
  const CatIcon  = catMeta.icon;
  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: catColor + "20" }}>
        <CatIcon className="w-[18px] h-[18px]" style={{ color: catColor }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-5">
          {expense.description || expense.categoryName || "Expense"}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {expense.categoryName && (
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: catColor + "18", color: catColor }}>{expense.categoryName}</span>
          )}
          {accountName && (
            <span className="text-xs text-muted-foreground/50">{accountName}</span>
          )}
          {expense.paymentMethod === "CREDIT_CARD" && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-500 dark:text-rose-400 font-medium">Card</span>
          )}
        </div>
      </div>
      <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums shrink-0">−{formatCurrency(expense.amount)}</p>
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function IncomeRow({ entry, accountName, onEdit, onDelete }: {
  entry:       IncomeEntry;
  accountName: string | undefined;
  onEdit:      () => void;
  onDelete:    () => void;
}) {
  const src     = INCOME_ICON_MAP[entry.source] ?? INCOME_ICON_MAP.OTHER;
  const IncIcon = src.icon;
  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: src.color + "20" }}>
        <IncIcon className="w-[18px] h-[18px]" style={{ color: src.color }} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-5">
          {entry.description || INCOME_SOURCES.find(s => s.value === entry.source)?.label || entry.source}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: src.color + "20", color: src.color }}>
            {INCOME_SOURCES.find(s => s.value === entry.source)?.label ?? entry.source}
          </span>
          {accountName && <span className="text-xs text-muted-foreground/50">{accountName}</span>}
        </div>
      </div>
      <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums shrink-0">+{formatCurrency(entry.amount)}</p>
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function TransferRow({ transfer, onEdit, onDelete }: {
  transfer: AccountTransfer;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
        <ArrowLeftRight className="w-[18px] h-[18px] text-violet-500 dark:text-violet-400" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-5">
          {transfer.description || `${transfer.fromAccountName} → ${transfer.toAccountName}`}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">
          {transfer.fromAccountName} → {transfer.toAccountName}
        </p>
      </div>
      <p className="text-sm font-bold text-violet-500 dark:text-violet-400 tabular-nums shrink-0">{formatCurrency(transfer.amount)}</p>
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shrink-0">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-indigo-500/60 hover:text-indigo-500 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Sort Pills ───────────────────────────────────────────────────────────────

function SortPills<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-xl border border-border/50">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 h-8 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
            value === o.value
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground",
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Type Tab Bar ─────────────────────────────────────────────────────────────

function TypeTabs({ value, onChange, counts }: { value: TxType; onChange: (t: TxType) => void; counts: Record<TxType, number> }) {
  const tabs: { key: TxType; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "all",       label: "All",       icon: <Receipt className="w-3.5 h-3.5" />,          color: "text-foreground" },
    { key: "expenses",  label: "Expenses",  icon: <ArrowDownLeft className="w-3.5 h-3.5" />,   color: "text-red-500" },
    { key: "income",    label: "Income",    icon: <ArrowUpRight className="w-3.5 h-3.5" />,    color: "text-emerald-500" },
    { key: "transfers", label: "Transfers", icon: <ArrowLeftRight className="w-3.5 h-3.5" />,  color: "text-blue-500" },
  ];
  return (
    <div className="flex items-center gap-1 bg-muted/60 border border-border rounded-2xl p-1 self-start overflow-x-auto max-w-full" style={{ scrollbarWidth: "none" }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-1.5 px-4 h-9 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
            value === t.key
              ? cn("bg-card shadow-sm", t.color)
              : "text-muted-foreground hover:text-foreground"
          )}>
          {t.icon} {t.label}
          <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground tabular-nums">{counts[t.key]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Shared Date Controls ─────────────────────────────────────────────────────

function DateControls({ dateMode, setDateMode, year, setYear, month, setMonth,
  customStart, setCustomStart, customEnd, setCustomEnd }: {
  dateMode: DateMode; setDateMode: (m: DateMode) => void;
  year: number; setYear: (y: number) => void;
  month: number; setMonth: (m: number) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void;
}) {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const navigateMonth = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5">
          {(["month", "year", "all", "custom"] as DateMode[]).map(m => (
            <button key={m} onClick={() => setDateMode(m)}
              className={cn("px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all",
                dateMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {m === "month" ? "Month" : m === "year" ? "Year" : m === "custom" ? "Custom" : "All"}
            </button>
          ))}
        </div>
        {dateMode === "month" && (
          <>
            <button onClick={() => navigateMonth(-1)}
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[130px] text-center">{monthLabel(year, month)}</span>
            <button onClick={() => navigateMonth(1)} disabled={isCurrentMonth}
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </>
        )}
        {dateMode === "year" && (
          <>
            <button onClick={() => setYear(year - 1)}
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground min-w-[48px] text-center">{year}</span>
            <button onClick={() => setYear(year + 1)} disabled={year >= now.getFullYear()}
              className="w-7 h-7 rounded-lg bg-muted/60 border border-border hover:bg-muted flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </>
        )}
      </div>
      {dateMode === "custom" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-44">
            <FormDatePicker label="From" value={customStart} onChange={setCustomStart} placeholder="Start date" />
          </div>
          <div className="w-44">
            <FormDatePicker label="To" value={customEnd} onChange={setCustomEnd} placeholder="End date" />
          </div>
          {customStart && customEnd && customEnd < customStart && (
            <p className="text-xs text-red-500 w-full">"To" date must be on or after "From" date.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const now = new Date();
  const searchParams = useSearchParams();

  // Type tab
  const [txType, setTxType] = useState<TxType>("all");

  // Shared date state
  const [dateMode,    setDateMode]    = useState<DateMode>("month");
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");

  // Expense-specific state
  const [payChannel,       setPayChannel]       = useState<Channel>("");
  const [categoryId,       setCategoryId]       = useState("");
  const [minAmount,        setMinAmount]        = useState<number | "">("");
  const [maxAmount,        setMaxAmount]        = useState<number | "">("");
  const [sortKey,          setSortKey]          = useState<SortKey>("date-desc");
  const [recurringOnly,    setRecurringOnly]    = useState(false);
  const [search,           setSearch]           = useState("");
  const [showCreate,       setShowCreate]       = useState(false);
  const [editExpense,      setEditExpense]      = useState<Expense | null>(null);
  const [confirmId,        setConfirmId]        = useState<string | null>(null);
  const [showCatDropdown,  setShowCatDropdown]  = useState(false);
  const [showAmtPopover,   setShowAmtPopover]   = useState(false);
  const [listPage,         setListPage]         = useState(0);

  // Income state
  const [showAddIncome,   setShowAddIncome]   = useState(false);
  const [editIncome,      setEditIncome]      = useState<IncomeEntry | null>(null);
  const [confirmIncomeId, setConfirmIncomeId] = useState<string | null>(null);
  const [incomeSearch,    setIncomeSearch]    = useState("");
  const [incomeSort,      setIncomeSort]      = useState<"newest"|"oldest"|"high"|"low">("newest");

  // Transfer state
  const [showAddTransfer,   setShowAddTransfer]   = useState(false);
  const [editTransfer,      setEditTransfer]      = useState<AccountTransfer | null>(null);
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);
  const [transferSearch,    setTransferSearch]    = useState("");
  const [transferSort,      setTransferSort]      = useState<"newest"|"oldest"|"high"|"low">("newest");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // All-tab pagination
  const [allPage, setAllPage] = useState(0);
  const ALL_PAGE_SIZE = 20;
  const [allSearch, setAllSearch] = useState("");

  const debouncedSearch = useDebounce(search, 400);
  const { currency: currCode } = usePrefsStore();
  const currSymbol = CURRENCIES.find(c => c.code === currCode)?.symbol ?? "₹";

  const { data: categories = [] }       = useCategories("EXPENSE");
  const { data: incomeCategories = [] } = useCategories("INCOME");
  const { data: allAccounts = [] }      = useAccounts();

  const cashAccounts   = allAccounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts   = allAccounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const creditAccounts = allAccounts.filter(a => a.accountType === "CREDIT_CARD");
  const accountMap     = useMemo(() => Object.fromEntries(allAccounts.map(a => [a.id, a.name])),        [allAccounts]);
  const accountTypeMap = useMemo(() => Object.fromEntries(allAccounts.map(a => [a.id, a.accountType])), [allAccounts]);

  // Derived date range
  const { startDate, endDate } = useMemo(() => {
    if (dateMode === "month") return {
      startDate: `${year}-${pad(month)}-01`,
      endDate:   new Date(year, month, 0).toISOString().split("T")[0],
    };
    if (dateMode === "year") return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    if (dateMode === "custom") {
      if (customStart && customEnd && customEnd < customStart) return { startDate: undefined, endDate: undefined };
      return { startDate: customStart || undefined, endDate: customEnd || undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateMode, year, month, customStart, customEnd]);

  // ─── Expense data ──────────────────────────────────────────────────────────
  const accountIds = useMemo(() => {
    if (payChannel === "CASH")    return cashAccounts.map(a => a.id);
    if (payChannel === "ACCOUNT") return bankAccounts.map(a => a.id);
    if (payChannel === "CREDIT")  return creditAccounts.map(a => a.id);
    return [];
  }, [payChannel, cashAccounts, bankAccounts, creditAccounts]);

  const [sortBy, sortDir] = sortKey.split("-") as ["expenseDate" | "amount", "asc" | "desc"];
  const PAGE_SIZE = 25;

  const expenseFilters = {
    startDate:  recurringOnly ? undefined : startDate as string | undefined,
    endDate:    recurringOnly ? undefined : endDate as string | undefined,
    search:     debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    accountIds: accountIds.length ? accountIds : undefined,
    minAmount:  minAmount !== "" ? Number(minAmount) : undefined,
    maxAmount:  maxAmount !== "" ? Number(maxAmount) : undefined,
    recurring:  recurringOnly ? true : undefined,
    sortBy, sortDir,
    page: listPage,
    size: PAGE_SIZE,
  };

  const { data: expenseData, isLoading: expensesLoading } = useExpenses(expenseFilters);

  // For prev-month comparison
  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYearNum  = month === 1 ? year - 1 : year;
  const { data: prevMonthData } = useExpenses({
    startDate: `${prevYearNum}-${pad(prevMonthNum)}-01`,
    endDate:   new Date(prevYearNum, prevMonthNum, 0).toISOString().split("T")[0],
    size: 500, sortDir: "desc",
  });
  const prevMonthTotal = (prevMonthData?.data ?? []).reduce((s, e) => s + e.amount, 0);

  // ─── Income data ───────────────────────────────────────────────────────────
  const incomeYear  = dateMode === "all" ? undefined : year;
  const incomeMonth = dateMode === "month" ? month : undefined;
  const { data: incomeData = [], isLoading: incomeLoading } = useIncome(incomeYear, incomeMonth);
  const { data: allIncomeRaw = [] } = useIncome(incomeYear, incomeMonth, true);

  // ─── Transfer data ─────────────────────────────────────────────────────────
  const { data: transfersPage, isLoading: transfersLoading } = useTransfers(0, 500);
  const allTransfers = transfersPage?.data ?? [];

  // Filter transfers by date range client-side
  const filteredTransfers = useMemo(() => {
    if (dateMode === "all") return allTransfers;
    return allTransfers.filter(t => {
      if (dateMode === "month")  return t.transferDate.startsWith(`${year}-${pad(month)}`);
      if (dateMode === "year")   return t.transferDate.startsWith(`${year}`);
      if (dateMode === "custom") {
        const d = t.transferDate;
        if (startDate && d < startDate) return false;
        if (endDate   && d > endDate)   return false;
        return true;
      }
      return true;
    });
  }, [allTransfers, dateMode, year, month, startDate, endDate]);

  // Filter income by date range (when dateMode = custom/year, we already filter server-side by year but need client-side custom)
  const filteredIncome = useMemo(() => {
    if (dateMode === "custom" && startDate && endDate) {
      return incomeData.filter(i => i.incomeDate >= startDate && i.incomeDate <= endDate);
    }
    return incomeData;
  }, [incomeData, dateMode, startDate, endDate]);

  // Income search
  const debouncedIncomeSearch = useDebounce(incomeSearch, 300);
  const searchedIncome = useMemo(() => {
    if (!debouncedIncomeSearch) return filteredIncome;
    const q = debouncedIncomeSearch.toLowerCase();
    return filteredIncome.filter(i =>
      (i.description ?? "").toLowerCase().includes(q) ||
      (INCOME_SOURCES.find(s => s.value === i.source)?.label ?? "").toLowerCase().includes(q)
    );
  }, [filteredIncome, debouncedIncomeSearch]);

  // Transfer search
  const debouncedTransferSearch = useDebounce(transferSearch, 300);
  const searchedTransfers = useMemo(() => {
    let base = filteredTransfers;
    if (selectedAccountIds.length > 0) {
      base = base.filter(t =>
        selectedAccountIds.includes(t.fromAccountId) ||
        selectedAccountIds.includes(t.toAccountId)
      );
    }
    if (!debouncedTransferSearch) return base;
    const q = debouncedTransferSearch.toLowerCase();
    return base.filter(t =>
      (t.description ?? "").toLowerCase().includes(q) ||
      t.fromAccountName.toLowerCase().includes(q) ||
      t.toAccountName.toLowerCase().includes(q)
    );
  }, [filteredTransfers, debouncedTransferSearch, selectedAccountIds]);

  // ─── "All" merged rows ─────────────────────────────────────────────────────
  type TxRow =
    | { kind: "expense";  date: string; data: Expense }
    | { kind: "income";   date: string; data: IncomeEntry }
    | { kind: "transfer"; date: string; data: AccountTransfer };

  const { data: allExpensesRaw } = useExpenses({
    startDate: startDate as string | undefined,
    endDate:   endDate as string | undefined,
    page: 0, size: 300, sortDir: "desc", includeDebt: true,
  });

  const filteredAllIncome = useMemo(() => {
    if (dateMode === "custom" && startDate && endDate) {
      return allIncomeRaw.filter(i => i.incomeDate >= startDate && i.incomeDate <= endDate);
    }
    return allIncomeRaw;
  }, [allIncomeRaw, dateMode, startDate, endDate]);

  const mergedRows = useMemo<TxRow[]>(() => {
    if (txType !== "all") return [];
    const rows: TxRow[] = [
      ...(allExpensesRaw?.data ?? []).map(e => ({ kind: "expense" as const, date: e.expenseDate, data: e })),
      ...filteredAllIncome.map(i => ({ kind: "income" as const, date: i.incomeDate, data: i })),
      ...filteredTransfers.map(t => ({ kind: "transfer" as const, date: t.transferDate, data: t })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.data.createdAt.localeCompare(a.data.createdAt));
  }, [txType, allExpensesRaw, filteredAllIncome, filteredTransfers]);

  const filteredMergedRows = useMemo(() => {
    if (!allSearch.trim()) return mergedRows;
    const q = allSearch.toLowerCase();
    return mergedRows.filter(row => {
      if (row.kind === "expense") {
        const e = row.data as Expense;
        return (e.description ?? "").toLowerCase().includes(q) ||
               (e.categoryName ?? "").toLowerCase().includes(q) ||
               String(e.amount).includes(q);
      }
      if (row.kind === "income") {
        const inc = row.data as IncomeEntry;
        return (inc.description ?? "").toLowerCase().includes(q) ||
               (INCOME_SOURCES.find(s => s.value === inc.source)?.label ?? "").toLowerCase().includes(q) ||
               String(inc.amount).includes(q);
      }
      const t = row.data as AccountTransfer;
      return (t.description ?? "").toLowerCase().includes(q) ||
             t.fromAccountName.toLowerCase().includes(q) ||
             t.toAccountName.toLowerCase().includes(q) ||
             String(t.amount).includes(q);
    });
  }, [mergedRows, allSearch]);

  const allTotalPages = Math.max(1, Math.ceil(filteredMergedRows.length / ALL_PAGE_SIZE));
  const pagedMergedRows = filteredMergedRows.slice(allPage * ALL_PAGE_SIZE, (allPage + 1) * ALL_PAGE_SIZE);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: createExpense, isPending: creating } = useCreateExpense();
  const { mutate: updateExpense, isPending: updating } = useUpdateExpense();
  const { mutate: deleteExpense }                      = useDeleteExpense();
  const { mutate: createIncome,  isPending: addingIncome }    = useCreateIncome();
  const { mutate: updateIncome,  isPending: updatingIncome }  = useUpdateIncome();
  const { mutate: deleteIncome }                              = useDeleteIncome();
  const { mutate: createTransfer, isPending: transferring }   = useTransfer();
  const { mutate: updateTransfer, isPending: updatingTransfer } = useUpdateTransfer();
  const { mutate: deleteTransfer }                            = useDeleteTransfer();

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const categoryName    = categories.find(c => c.id === categoryId)?.name;

  function resolvePaymentMethod(accountId: string | undefined) {
    if (!accountId) return undefined;
    const type = accountTypeMap[accountId];
    if (!type) return undefined;
    return type === "CASH_WALLET" ? "CASH" : type === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK_ACCOUNT";
  }

  const handleCreate = (values: ExpenseFormValues) => {
    const accountId = values.accountId || undefined;
    createExpense(
      { ...values, amount: Number(values.amount), accountId, paymentMethod: resolvePaymentMethod(accountId) },
      { onSuccess: () => setShowCreate(false) }
    );
  };

  const handleUpdate = (values: ExpenseFormValues) => {
    if (!editExpense) return;
    const accountId = values.accountId || undefined;
    updateExpense(
      { id: editExpense.id, payload: { ...values, amount: Number(values.amount), accountId, paymentMethod: resolvePaymentMethod(accountId) } },
      { onSuccess: () => setEditExpense(null) }
    );
  };

  const handleAddIncome = (values: IncomeFormValues) => {
    const d = new Date(values.incomeDate);
    createIncome(
      {
        source: values.source,
        amount: Number(values.amount),
        incomeDate: values.incomeDate,
        periodMonth: d.getMonth() + 1,
        periodYear:  d.getFullYear(),
        accountId:   values.accountId || undefined,
        description: values.description || undefined,
        paymentMode: (() => {
          if (!values.accountId) return "CASH";
          const acc = allAccounts.find(a => a.id === values.accountId);
          return acc?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT";
        })(),
      },
      { onSuccess: () => setShowAddIncome(false) }
    );
  };

  const handleAddTransfer = (values: TransferFormValues) => {
    createTransfer(
      { fromAccountId: values.fromAccountId, toAccountId: values.toAccountId,
        amount: Number(values.amount), transferDate: values.transferDate,
        description: values.description || undefined },
      { onSuccess: () => setShowAddTransfer(false) }
    );
  };

  const handleUpdateIncome = (values: IncomeFormValues) => {
    if (!editIncome) return;
    const d = new Date(values.incomeDate);
    updateIncome(
      { id: editIncome.id, payload: {
        source: values.source, amount: Number(values.amount),
        incomeDate: values.incomeDate,
        periodMonth: d.getMonth() + 1, periodYear: d.getFullYear(),
        accountId: values.accountId || undefined,
        description: values.description || undefined,
        paymentMode: (() => {
          if (!values.accountId) return "CASH";
          const acc = allAccounts.find(a => a.id === values.accountId);
          return acc?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT";
        })(),
      }},
      { onSuccess: () => setEditIncome(null) }
    );
  };

  const handleUpdateTransfer = (values: TransferFormValues) => {
    if (!editTransfer) return;
    updateTransfer(
      { id: editTransfer.id, payload: {
        amount: Number(values.amount), transferDate: values.transferDate,
        description: values.description || undefined,
      }},
      { onSuccess: () => setEditTransfer(null) }
    );
  };

  // Expense filter helpers
  const clearAllFilters = () => {
    setPayChannel(""); setCategoryId(""); setMinAmount(""); setMaxAmount("");
    setSortKey("date-desc"); setDateMode("month"); setRecurringOnly(false);
    setYear(now.getFullYear()); setMonth(now.getMonth() + 1);
    setCustomStart(""); setCustomEnd(""); setListPage(0);
  };

  // Read URL params on mount and apply tab + account filter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "transfers" || tab === "income" || tab === "all" || tab === "expenses") {
      setTxType(tab as TxType);
    }
    const accountId = searchParams.get("accountId");
    if (accountId) {
      setSelectedAccountIds([accountId]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setListPage(0); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startDate, endDate, debouncedSearch, categoryId, payChannel, minAmount, maxAmount, sortKey, recurringOnly]);

  useEffect(() => { setAllPage(0); }, [txType, dateMode, year, month, customStart, customEnd, allSearch]);

  const activeFilterCount = [
    payChannel !== "", categoryId !== "", minAmount !== "" || maxAmount !== "",
    sortKey !== "date-desc", dateMode !== "month", recurringOnly,
  ].filter(Boolean).length;

  const expenses      = expenseData?.data ?? [];
  const totalSpent    = expenses.reduce((s, e) => s + e.amount, 0);
  const serverTotal   = expenseData?.meta?.totalElements ?? 0;
  const totalPages    = expenseData?.meta?.totalPages ?? 1;

  const grouped = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.expenseDate]) acc[e.expenseDate] = [];
    acc[e.expenseDate].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) =>
    sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));

  const topCategory = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    expenses.forEach(e => {
      if (!e.categoryId) return;
      if (!map[e.categoryId]) map[e.categoryId] = { name: e.categoryName ?? "Unknown", total: 0 };
      map[e.categoryId].total += e.amount;
    });
    return Object.values(map).sort((a, b) => b.total - a.total)[0];
  }, [expenses]);

  const csvLabel = dateMode === "month" ? `${year}-${pad(month)}`
    : dateMode === "year" ? `${year}`
    : dateMode === "custom" ? `${customStart ?? "start"}-to-${customEnd ?? "end"}`
    : "all";

  const chips: { label: string; clear: () => void }[] = [];
  if (payChannel === "CASH")    chips.push({ label: "Cash only",    clear: () => setPayChannel("") });
  if (payChannel === "ACCOUNT") chips.push({ label: "Bank account", clear: () => setPayChannel("") });
  if (payChannel === "CREDIT")  chips.push({ label: "Credit card",  clear: () => setPayChannel("") });
  if (categoryId)               chips.push({ label: categoryName ?? "Category", clear: () => setCategoryId("") });
  if (minAmount !== "")         chips.push({ label: `Min ${currSymbol}${minAmount}`, clear: () => setMinAmount("") });
  if (maxAmount !== "")         chips.push({ label: `Max ${currSymbol}${maxAmount}`, clear: () => setMaxAmount("") });
  if (sortKey !== "date-desc")  chips.push({ label: ({"date-asc":"Oldest first","amount-desc":"Highest first","amount-asc":"Lowest first"} as Record<string,string>)[sortKey], clear: () => setSortKey("date-desc") });
  if (recurringOnly)            chips.push({ label: "Recurring only", clear: () => setRecurringOnly(false) });
  if (dateMode === "year")      chips.push({ label: `Year ${year}`,   clear: () => setDateMode("month") });
  if (dateMode === "custom")    chips.push({ label: "Custom range",   clear: () => setDateMode("month") });
  if (dateMode === "all")       chips.push({ label: "All time",       clear: () => setDateMode("month") });

  const sharedFormProps = {
    categoryOptions,
    cashAccounts:   cashAccounts.map(a => ({ id: a.id, name: a.name, currentBalance: a.currentBalance })),
    bankAccounts:   bankAccounts.map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance })),
    creditAccounts: creditAccounts.map(a => ({ id: a.id, name: a.name, bankName: a.bankName, currentBalance: a.currentBalance })),
  };

  // Grouped income rows (with sort)
  const incomeGroupedRaw = searchedIncome.reduce<Record<string, IncomeEntry[]>>((acc, i) => {
    if (!acc[i.incomeDate]) acc[i.incomeDate] = [];
    acc[i.incomeDate].push(i);
    return acc;
  }, {});
  const incomeGrouped = (incomeSort === "high" || incomeSort === "low")
    ? Object.fromEntries(Object.entries(incomeGroupedRaw).map(([date, items]) => [
        date,
        [...items].sort((a, b) => incomeSort === "high" ? b.amount - a.amount : a.amount - b.amount)
      ]))
    : incomeGroupedRaw;
  const incomeSortedDates = Object.keys(incomeGrouped).sort((a, b) =>
    incomeSort === "oldest" ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Grouped transfer rows (with sort)
  const transferGroupedRaw = searchedTransfers.reduce<Record<string, AccountTransfer[]>>((acc, t) => {
    if (!acc[t.transferDate]) acc[t.transferDate] = [];
    acc[t.transferDate].push(t);
    return acc;
  }, {});
  const transferGrouped = (transferSort === "high" || transferSort === "low")
    ? Object.fromEntries(Object.entries(transferGroupedRaw).map(([date, items]) => [
        date,
        [...items].sort((a, b) => transferSort === "high" ? b.amount - a.amount : a.amount - b.amount)
      ]))
    : transferGroupedRaw;
  const transferSortedDates = Object.keys(transferGrouped).sort((a, b) =>
    transferSort === "oldest" ? a.localeCompare(b) : b.localeCompare(a)
  );

  // Merged "All" grouped
  const allGrouped = pagedMergedRows.reduce<Record<string, TxRow[]>>((acc, r) => {
    if (!acc[r.date]) acc[r.date] = [];
    acc[r.date].push(r);
    return acc;
  }, {});
  const allSortedDates = Object.keys(allGrouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Transactions" />

      {/* Expense modals */}
      {confirmId && (
        <ConfirmDialog open title="Delete Expense"
          description="This expense will be permanently deleted and cannot be undone."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteExpense(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {confirmIncomeId && (
        <ConfirmDialog open title="Delete Income Entry"
          description="This income entry will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteIncome(confirmIncomeId); setConfirmIncomeId(null); }}
          onCancel={() => setConfirmIncomeId(null)} />
      )}
      {confirmTransferId && (
        <ConfirmDialog open title="Delete Transfer"
          description="This transfer record will be permanently deleted."
          confirmLabel="Delete" danger
          onConfirm={() => { deleteTransfer(confirmTransferId); setConfirmTransferId(null); }}
          onCancel={() => setConfirmTransferId(null)} />
      )}

      {/* Add/edit modals */}
      {(showCreate || editExpense) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowCreate(false); setEditExpense(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {showCreate && (
              <ExpenseForm title="New Expense" {...sharedFormProps}
                onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
                isPending={creating} submitLabel="Add Expense" />
            )}
            {editExpense && (
              <ExpenseForm
                title={`Edit — ${editExpense.description || editExpense.categoryName || "Expense"}`}
                defaultValues={{ categoryId: editExpense.categoryId, accountId: editExpense.accountId ?? "",
                  amount: editExpense.amount, description: editExpense.description ?? "", expenseDate: editExpense.expenseDate }}
                {...sharedFormProps}
                onSubmit={handleUpdate} onCancel={() => setEditExpense(null)}
                isPending={updating} submitLabel="Save Changes" />
            )}
          </div>
        </div>
      )}

      {(showAddIncome || editIncome) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAddIncome(false); setEditIncome(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {showAddIncome && (
              <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowAddIncome(false)}
                isPending={addingIncome} accounts={allAccounts} incomeCategories={incomeCategories} />
            )}
            {editIncome && (
              <IncomeForm
                defaultValues={{ source: editIncome.source, amount: String(editIncome.amount),
                  incomeDate: editIncome.incomeDate, accountId: editIncome.accountId ?? "",
                  description: editIncome.description ?? "" }}
                onSubmit={handleUpdateIncome} onCancel={() => setEditIncome(null)}
                isPending={updatingIncome} accounts={allAccounts} incomeCategories={incomeCategories} isEdit />
            )}
          </div>
        </div>
      )}

      {(showAddTransfer || editTransfer) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setShowAddTransfer(false); setEditTransfer(null); }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {showAddTransfer && (
              <TransferFormModal onSubmit={handleAddTransfer} onCancel={() => setShowAddTransfer(false)}
                isPending={transferring} accounts={allAccounts} />
            )}
            {editTransfer && (
              <TransferFormModal
                editTransferRef={editTransfer}
                onSubmit={handleUpdateTransfer} onCancel={() => setEditTransfer(null)}
                isPending={updatingTransfer} accounts={allAccounts} isEdit />
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-36 lg:pb-24 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-4">

        {/* Type tabs */}
        <TypeTabs value={txType} onChange={v => { setTxType(v); }} counts={{
          expenses: serverTotal,
          income: searchedIncome.length,
          transfers: searchedTransfers.length,
          all: serverTotal + searchedIncome.length + searchedTransfers.length,
        }} />

        {/* Shared date controls */}
        <DateControls
          dateMode={dateMode} setDateMode={setDateMode}
          year={year} setYear={setYear}
          month={month} setMonth={setMonth}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
        />

        {/* ── EXPENSES TAB ─────────────────────────────────────────────────── */}
        {txType === "expenses" && (
          <div className="space-y-3">
            {/* toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-44">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all" />
              </div>
              <SortPills
                value={sortKey}
                onChange={v => setSortKey(v as SortKey)}
                options={[
                  { value: "date-desc",   label: "Newest" },
                  { value: "date-asc",    label: "Oldest" },
                  { value: "amount-desc", label: "Highest" },
                  { value: "amount-asc",  label: "Lowest" },
                ]}
              />
              {expenses.length > 0 && (
                <button onClick={() => exportCsv(expenses, csvLabel, accountMap, accountTypeMap)}
                  className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all">
                  <Download className="w-4 h-4" /> Export
                </button>
              )}
              <button onClick={() => { setShowCreate(v => !v); setEditExpense(null); }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 h-10 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* filter toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center h-9 bg-muted/60 border border-border rounded-xl p-0.5">
                {(["", "CASH", "ACCOUNT", "CREDIT"] as Channel[]).map(ch => (
                  <button key={ch} onClick={() => setPayChannel(ch)}
                    className={cn("flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
                      payChannel === ch ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {ch === ""       ? "All"
                    : ch === "CASH"    ? <><Banknote   className="w-3 h-3" /> Cash</>
                    : ch === "ACCOUNT" ? <><Building2  className="w-3 h-3" /> Bank</>
                    :                    <><CreditCard className="w-3 h-3" /> Card</>}
                  </button>
                ))}
              </div>
              <button onClick={() => setRecurringOnly(v => !v)}
                className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                  recurringOnly
                    ? "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400"
                    : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                <RefreshCw className="w-3 h-3" /> Recurring
              </button>
              {/* Category dropdown */}
              <div className="relative">
                <button onClick={() => { setShowCatDropdown(v => !v); setShowAmtPopover(false); }}
                  className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                    categoryId
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  {categoryId ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: categories.find(c => c.id === categoryId)?.color ?? "#6366f1" }} />
                      <span className="max-w-[80px] truncate">{categoryName}</span>
                    </>
                  ) : "Category"}
                  <ChevronDown className="w-3 h-3 shrink-0" />
                </button>
                {showCatDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 w-52 max-h-56 overflow-y-auto">
                    <button onClick={() => { setCategoryId(""); setShowCatDropdown(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors">
                      All categories {!categoryId && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ml-auto" />}
                    </button>
                    {categories.map(c => (
                      <button key={c.id}
                        onClick={() => { setCategoryId(c.id === categoryId ? "" : c.id); setShowCatDropdown(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted/60 transition-colors">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color ?? "#6366f1" }} />
                        <span className="flex-1 text-left">{c.name}</span>
                        {categoryId === c.id && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Amount range */}
              <div className="relative">
                <button onClick={() => { setShowAmtPopover(v => !v); setShowCatDropdown(false); }}
                  className={cn("flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all",
                    minAmount !== "" || maxAmount !== ""
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                      : "bg-muted/60 border-border text-muted-foreground hover:text-foreground")}>
                  {minAmount !== "" || maxAmount !== ""
                    ? `${currSymbol}${minAmount || 0} – ${maxAmount || "∞"}`
                    : "Amount"}
                  <ChevronDown className="w-3 h-3 shrink-0" />
                </button>
                {showAmtPopover && (
                  <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 p-4 w-52">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground/80 mb-1.5">Min ({currSymbol})</p>
                        <input type="number" min={0} placeholder="0" value={minAmount} onFocus={e => e.target.select()}
                          onChange={e => setMinAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground/80 mb-1.5">Max ({currSymbol})</p>
                        <input type="number" min={0} placeholder="∞" value={maxAmount} onFocus={e => e.target.select()}
                          onChange={e => setMaxAmount(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      {(minAmount !== "" || maxAmount !== "") && (
                        <button onClick={() => { setMinAmount(""); setMaxAmount(""); setShowAmtPopover(false); }}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors">Clear range</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-400 transition-colors h-9 px-1">
                  <X className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map(c => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
              </div>
            )}

            {/* Summary */}
            {!expensesLoading && expenses.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Total Spent</p>
                  <p className="text-xl font-bold text-red-500 dark:text-red-400 tabular-nums">−{formatCurrency(totalSpent)}</p>
                  {dateMode === "month" && prevMonthTotal > 0 && (() => {
                    const diff = totalSpent - prevMonthTotal;
                    const isMore = diff > 0;
                    return (
                      <p className={cn("text-xs mt-1 font-medium", isMore ? "text-red-500/70" : "text-emerald-500")}>
                        {isMore ? "▲" : "▼"} {formatCurrency(Math.abs(diff))} vs last month
                      </p>
                    );
                  })()}
                </div>
                <div className="bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Transactions</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{serverTotal}</p>
                </div>
                {topCategory && (
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-4 py-3 col-span-2 sm:col-span-1">
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Top Category</p>
                    <p className="text-sm font-bold text-foreground truncate">{topCategory.name}</p>
                    <p className="text-xs text-muted-foreground/70 tabular-nums mt-0.5">{formatCurrency(topCategory.total)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Expense list */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">Expenses</h3>
                <div className="flex items-center gap-3">
                  {totalSpent > 0 && <span className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums">−{formatCurrency(totalSpent)}</span>}
                  <span className="text-xs text-muted-foreground/80">{serverTotal} total</span>
                </div>
              </div>
              {expensesLoading ? <TableRowSkeleton rows={6} /> : expenses.length === 0 ? (
                <EmptyState icon={Receipt} title="No expenses found"
                  description={activeFilterCount > 0 ? "No expenses match the active filters." : "Track your spending by adding your first expense."}
                  action={
                    activeFilterCount > 0
                      ? <button onClick={clearAllFilters} className="text-sm text-indigo-500 hover:text-indigo-600 font-medium transition-colors">Clear filters</button>
                      : <button onClick={() => setShowCreate(true)}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                          <Plus className="w-4 h-4" /> Add Expense
                        </button>
                  } />
              ) : (
                <div>
                  {sortedDates.map(date => {
                    const dayTotal = grouped[date].reduce((s, e) => s + e.amount, 0);
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                          <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                          <span className="text-xs font-semibold text-red-500/70 tabular-nums">−{formatCurrency(dayTotal)}</span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {grouped[date].map(expense => (
                            <ExpenseRow key={expense.id} expense={expense}
                              accountName={expense.accountId ? accountMap[expense.accountId] : undefined}
                              onEdit={() => { setShowCreate(false); setEditExpense(expense); }}
                              onDelete={() => setConfirmId(expense.id)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        {listPage * PAGE_SIZE + 1}–{Math.min((listPage + 1) * PAGE_SIZE, serverTotal)} of {serverTotal}
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setListPage(0)} disabled={listPage === 0}
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                        <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={listPage === 0}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground px-2 tabular-nums">{listPage + 1} / {totalPages}</span>
                        <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={listPage >= totalPages - 1}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setListPage(totalPages - 1)} disabled={listPage >= totalPages - 1}
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INCOME TAB ───────────────────────────────────────────────────── */}
        {txType === "income" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-44">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input placeholder="Search income…" value={incomeSearch} onChange={e => setIncomeSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all" />
              </div>
              <SortPills
                value={incomeSort}
                onChange={v => setIncomeSort(v as "newest"|"oldest"|"high"|"low")}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "high",   label: "Highest" },
                  { value: "low",    label: "Lowest" },
                ]}
              />
              {searchedIncome.length > 0 && (
                <button onClick={() => exportIncomeCsv(searchedIncome, csvLabel, accountMap)}
                  className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all">
                  <Download className="w-4 h-4" /> Export
                </button>
              )}
              <button onClick={() => setShowAddIncome(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-10 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> Add Income
              </button>
            </div>

            {searchedIncome.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Total Income</p>
                  <p className="text-xl font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">+{formatCurrency(searchedIncome.reduce((s, i) => s + i.amount, 0))}</p>
                </div>
                <div className="bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Entries</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{searchedIncome.length}</p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-foreground text-sm">Income</h3>
              </div>
              {incomeLoading ? <TableRowSkeleton rows={4} /> : searchedIncome.length === 0 ? (
                <EmptyState icon={ArrowUpRight} title="No income this period"
                  description="Record income to track what's coming in."
                  action={
                    <button onClick={() => setShowAddIncome(true)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                      <Plus className="w-4 h-4" /> Add Income
                    </button>
                  } />
              ) : (
                <div>
                  {incomeSortedDates.map(date => (
                    <div key={date}>
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                        <span className="text-xs font-semibold text-emerald-500/80 tabular-nums">
                          +{formatCurrency(incomeGrouped[date].reduce((s, i) => s + i.amount, 0))}
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {incomeGrouped[date].map(entry => (
                          <IncomeRow key={entry.id} entry={entry}
                            accountName={entry.accountId ? accountMap[entry.accountId] : undefined}
                            onEdit={() => { setShowAddIncome(false); setEditIncome(entry); }}
                            onDelete={() => setConfirmIncomeId(entry.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TRANSFERS TAB ────────────────────────────────────────────────── */}
        {txType === "transfers" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-44">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <input placeholder="Search transfers…" value={transferSearch} onChange={e => setTransferSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all" />
              </div>
              <SortPills
                value={transferSort}
                onChange={v => setTransferSort(v as "newest"|"oldest"|"high"|"low")}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "high",   label: "Highest" },
                  { value: "low",    label: "Lowest" },
                ]}
              />
              {searchedTransfers.length > 0 && (
                <button onClick={() => exportTransfersCsv(searchedTransfers, csvLabel)}
                  className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-muted border border-border text-muted-foreground hover:text-foreground transition-all">
                  <Download className="w-4 h-4" /> Export
                </button>
              )}
              <button onClick={() => setShowAddTransfer(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-10 rounded-xl text-sm font-medium transition-all">
                <Plus className="w-4 h-4" /> New Transfer
              </button>
            </div>

            {searchedTransfers.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Total Transferred</p>
                  <p className="text-xl font-bold text-violet-500 dark:text-violet-400 tabular-nums">{formatCurrency(searchedTransfers.reduce((s, t) => s + t.amount, 0))}</p>
                </div>
                <div className="bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Transfers</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">{searchedTransfers.length}</p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-foreground text-sm">Transfers</h3>
              </div>
              {transfersLoading ? <TableRowSkeleton rows={4} /> : searchedTransfers.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title="No transfers this period"
                  description="Move money between your accounts."
                  action={
                    <button onClick={() => setShowAddTransfer(true)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 h-9 rounded-xl text-sm font-medium transition-all">
                      <Plus className="w-4 h-4" /> New Transfer
                    </button>
                  } />
              ) : (
                <div>
                  {transferSortedDates.map(date => (
                    <div key={date}>
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                        <span className="text-xs font-semibold text-violet-500/70 tabular-nums">
                          {formatCurrency(transferGrouped[date].reduce((s, t) => s + t.amount, 0))}
                        </span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {transferGrouped[date].map(transfer => (
                          <TransferRow key={transfer.id} transfer={transfer}
                            onEdit={() => { setShowAddTransfer(false); setEditTransfer(transfer); }}
                            onDelete={() => setConfirmTransferId(transfer.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALL TAB ──────────────────────────────────────────────────────── */}
        {txType === "all" && (
          <div className="space-y-3">
            {mergedRows.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Money Out</p>
                  <p className="text-lg font-bold text-red-500 dark:text-red-400 tabular-nums">
                    −{formatCurrency(mergedRows.filter(r => r.kind === "expense").reduce((s, r) => s + (r.data as Expense).amount, 0))}
                  </p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Money In</p>
                  <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                    +{formatCurrency(mergedRows.filter(r => r.kind === "income").reduce((s, r) => s + (r.data as IncomeEntry).amount, 0))}
                  </p>
                </div>
                <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Transferred</p>
                  <p className="text-lg font-bold text-violet-500 dark:text-violet-400 tabular-nums">
                    {formatCurrency(mergedRows.filter(r => r.kind === "transfer").reduce((s, r) => s + (r.data as AccountTransfer).amount, 0))}
                  </p>
                </div>
                <div className="bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-1">Entries</p>
                  <p className="text-lg font-bold text-foreground tabular-nums">{mergedRows.length}</p>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <h3 className="font-semibold text-foreground text-sm">All Transactions</h3>
                <div className="ml-auto relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                  <input
                    value={allSearch}
                    onChange={e => setAllSearch(e.target.value)}
                    placeholder="Search transactions…"
                    className="h-8 pl-8 pr-3 w-48 rounded-xl bg-muted/60 border border-border text-xs text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {allSearch && (
                    <button onClick={() => setAllSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/80 hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {(expensesLoading || incomeLoading || transfersLoading) ? <TableRowSkeleton rows={6} /> :
               mergedRows.length === 0 ? (
                <EmptyState icon={Receipt} title="No transactions this period"
                  description="Switch to Expenses, Income, or Transfers tabs to add entries." />
              ) : (
                <div>
                  {allSortedDates.map(date => (
                    <div key={date}>
                      <div className="px-4 py-2 bg-muted/50 border-b border-border/50">
                        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-widest">{formatDate(date)}</span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {allGrouped[date].map((row, i) => {
                          if (row.kind === "expense") {
                            const e = row.data as Expense;
                            const catMeta2  = getCategoryMeta(e.categoryName ?? "");
                            const catColor2 = e.categoryColor ?? catMeta2.color;
                            const CatIcon2  = catMeta2.icon;
                            return (
                              <div key={i} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: catColor2 + "20" }}>
                                  <CatIcon2 className="w-[18px] h-[18px]" style={{ color: catColor2 }} strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate leading-5">
                                    {e.description || e.categoryName || "Expense"}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {e.debt ? (
                                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">Debt</span>
                                    ) : e.categoryName && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                        style={{ backgroundColor: catColor2 + "18", color: catColor2 }}>{e.categoryName}</span>
                                    )}
                                    {e.accountId && accountMap[e.accountId] && (
                                      <span className="text-xs text-muted-foreground/50">{accountMap[e.accountId]}</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums shrink-0">−{formatCurrency(e.amount)}</p>
                                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => { setShowCreate(false); setEditExpense(e); }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setConfirmId(e.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          if (row.kind === "income") {
                            const income = row.data as IncomeEntry;
                            const src2 = INCOME_ICON_MAP[income.source] ?? INCOME_ICON_MAP.OTHER;
                            const IncIcon2 = src2.icon;
                            return (
                              <div key={i} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: src2.color + "20" }}>
                                  <IncIcon2 className="w-[18px] h-[18px]" style={{ color: src2.color }} strokeWidth={1.75} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate leading-5">
                                    {income.description || INCOME_SOURCES.find(s => s.value === income.source)?.label || income.source}
                                  </p>
                                  {income.debt ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">Debt</span>
                                  ) : (
                                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                                      style={{ backgroundColor: src2.color + "20", color: src2.color }}>
                                      {INCOME_SOURCES.find(s => s.value === income.source)?.label ?? income.source}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums shrink-0">+{formatCurrency(income.amount)}</p>
                                <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                  <button onClick={() => setEditIncome(income)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setConfirmIncomeId(income.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          const transfer = row.data as AccountTransfer;
                          return (
                            <div key={i} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors">
                              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                                <ArrowLeftRight className="w-[18px] h-[18px] text-violet-500 dark:text-violet-400" strokeWidth={1.75} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate leading-5">
                                  {transfer.description || `${transfer.fromAccountName} → ${transfer.toAccountName}`}
                                </p>
                                <p className="text-xs text-muted-foreground/60 mt-0.5">
                                  {transfer.fromAccountName} → {transfer.toAccountName}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-violet-500 dark:text-violet-400 tabular-nums shrink-0">{formatCurrency(transfer.amount)}</p>
                              <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                <button onClick={() => setEditTransfer(transfer)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/15 transition-all">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmTransferId(transfer.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/15 transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* All-tab pagination */}
                  {allTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        {allPage * ALL_PAGE_SIZE + 1}–{Math.min((allPage + 1) * ALL_PAGE_SIZE, mergedRows.length)} of {mergedRows.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setAllPage(0)} disabled={allPage === 0}
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">«</button>
                        <button onClick={() => setAllPage(p => Math.max(0, p - 1))} disabled={allPage === 0}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <span className="text-xs text-muted-foreground px-2 tabular-nums">{allPage + 1} / {allTotalPages}</span>
                        <button onClick={() => setAllPage(p => Math.min(allTotalPages - 1, p + 1))} disabled={allPage >= allTotalPages - 1}
                          className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setAllPage(allTotalPages - 1)} disabled={allPage >= allTotalPages - 1}
                          className="px-1.5 py-1 rounded-lg hover:bg-muted disabled:opacity-30 text-xs text-muted-foreground font-medium transition-colors">»</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

</div>
      </main>

      {/* ── Floating Action Button ── */}
      <FloatingActionButton actions={[
        { icon: Receipt,        label: "Add Expense", color: "rose",    onClick: () => { setShowCreate(true); setEditExpense(null); }, disabled: allAccounts.length === 0 },
        { icon: Banknote,       label: "Add Income",  color: "emerald", onClick: () => { setShowAddIncome(true); setEditIncome(null); }, disabled: allAccounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0 },
        { icon: ArrowLeftRight, label: "Transfer",    color: "indigo",  onClick: () => { setShowAddTransfer(true); setEditTransfer(null); }, disabled: allAccounts.length < 2 },
      ]} />
    </div>
  );
}
