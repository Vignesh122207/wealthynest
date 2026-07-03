"use client";

import { useState, useRef, useMemo, CSSProperties } from "react";
import Link from "next/link";
import {
  Plus, ArrowLeftRight, Wallet, Banknote, ShieldCheck, Pencil, Trash2, Archive,
  TrendingUp, TrendingDown, X, Building2, ChevronDown, Activity,
  CreditCard, MinusCircle, AlertCircle, Calendar, ChevronLeft, ChevronRight,
  Filter, Wifi, Download, Eye, EyeOff, RefreshCw, ArchiveRestore,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Header } from "@/components/layout/Header";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormCurrencyInput } from "@/components/forms/FormCurrencyInput";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import {
  useAccounts, useArchivedAccounts, useCreateAccount, useUpdateAccount,
  useDeleteAccount, useArchiveAccount, useUnarchiveAccount,
  useTransfers, useTransfer, useUpdateTransfer, useDeleteTransfer,
  useAdjustBalance,
} from "@/features/accounts/hooks/useAccounts";
import { useExpenses, useUpdateExpense, useDeleteExpense, useCreateExpense } from "@/features/expenses/hooks/useExpenses";
import { expensesApi } from "@/features/expenses/api/expenses.api";
import type { Expense } from "@/features/expenses/types/expense.types";
import { useCreateIncome, useDeleteIncome, useUpdateIncome, useIncome } from "@/features/income/hooks/useIncome";
import { useDebts } from "@/features/debts/hooks/useDebts";
import type { DebtRecord } from "@/features/debts/types/debt.types";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { useCreateRecurringIncome } from "@/features/recurringIncome/hooks/useRecurringIncome";
import type { AccountType, WalletAccount } from "@/features/accounts/types/account.types";
import { INDIAN_BANKS, INCOME_SOURCES, INCOME_SOURCE_ICONS } from "@/lib/constants";
import { formatCurrency, formatCurrencyCompact, formatDate, cn } from "@/lib/utils";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createAccountSchema = z.object({
  accountType:    z.enum(["CASH_WALLET", "BANK_ACCOUNT", "EMERGENCY_FUND", "CREDIT_CARD"]),
  name:           z.string().min(1, "Name is required").max(100),
  bankName:       z.string().max(100).optional(),
  accountNumber:  z.string().max(20).optional(),
  openingBalance: z.coerce.number().min(0, "Balance must be 0 or more"),
  creditLimit:    z.coerce.number().positive().optional(),
  statementDay:   z.coerce.number().min(1).max(28).optional(),
  paymentDueDay:  z.coerce.number().min(1).max(28).optional(),
  apr:            z.coerce.number().min(0).max(100).optional(),
});

const addMoneySchema = z.object({
  accountId:   z.string().uuid("Select an account"),
  source:      z.enum(["SALARY","FREELANCE","BUSINESS","RENTAL","BONUS","INTEREST","DIVIDEND","OTHER"]),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(255).optional(),
  incomeDate:  z.string().min(1, "Date is required"),
});

const addExpenseSchema = z.object({
  accountId:   z.string().uuid("Select an account"),
  categoryId:  z.string().uuid("Select a category"),
  amount:      z.coerce.number().positive("Amount must be positive"),
  description: z.string().max(255).optional(),
  expenseDate: z.string().min(1, "Date is required"),
});

const transferSchema = z.object({
  fromAccountId: z.string().uuid("Select source account"),
  toAccountId:   z.string().uuid("Select destination account"),
  amount:        z.coerce.number().positive("Amount must be positive"),
  description:   z.string().max(255).optional(),
  transferDate:  z.string().min(1, "Date is required"),
});

type CreateAccountForm = z.infer<typeof createAccountSchema>;
type AddMoneyForm      = z.infer<typeof addMoneySchema>;
type AddExpenseForm    = z.infer<typeof addExpenseSchema>;
type TransferForm      = z.infer<typeof transferSchema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: typeof Wallet; color: string; bg: string }> = {
  CASH_WALLET:    { label: "Cash Wallet",    icon: Banknote,    color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  BANK_ACCOUNT:   { label: "Bank Account",   icon: Building2,   color: "text-indigo-500 dark:text-indigo-400",   bg: "bg-indigo-500/10"  },
  EMERGENCY_FUND: { label: "Emergency Fund", icon: ShieldCheck, color: "text-amber-500 dark:text-amber-400",     bg: "bg-amber-500/10"   },
  CREDIT_CARD:    { label: "Credit Card",    icon: CreditCard,  color: "text-white",                             bg: "bg-white/15"       },
};

const TXN_COLORS: Record<string, string> = {
  INCOME:       "text-emerald-500 dark:text-emerald-400",
  EXPENSE:      "text-red-500 dark:text-red-400",
  TRANSFER_IN:  "text-indigo-500 dark:text-indigo-400",
  TRANSFER_OUT: "text-amber-500 dark:text-amber-400",
  DEBT_OUT:     "text-orange-500 dark:text-orange-400",
  DEBT_IN:      "text-teal-500 dark:text-teal-400",
  ADJUSTMENT:   "text-violet-500 dark:text-violet-400",
};
const TXN_BG: Record<string, string> = {
  INCOME: "bg-emerald-500/10", EXPENSE: "bg-red-500/10",
  TRANSFER_IN: "bg-indigo-500/10", TRANSFER_OUT: "bg-amber-500/10",
  DEBT_OUT: "bg-orange-500/10", DEBT_IN: "bg-teal-500/10",
  ADJUSTMENT: "bg-violet-500/10",
};
const TXN_SIGN: Record<string, string> = {
  INCOME: "+", EXPENSE: "−", TRANSFER_IN: "+", TRANSFER_OUT: "−",
  DEBT_OUT: "−", DEBT_IN: "+", ADJUSTMENT: "±",
};

const INCOME_CATEGORY_SOURCE_MAP: Record<string, string> = {
  "salary": "SALARY", "freelance": "FREELANCE", "business": "BUSINESS",
  "business income": "BUSINESS", "rental": "RENTAL", "rental income": "RENTAL",
  "bonus": "BONUS", "interest": "INTEREST", "interest income": "INTEREST",
  "dividend": "DIVIDEND", "dividend income": "DIVIDEND",
  "other": "OTHER", "other income": "OTHER",
};
function incomeCategoryToSource(name: string) {
  return INCOME_CATEGORY_SOURCE_MAP[name.toLowerCase().trim()] ?? "OTHER";
}

// ─── Bank Name Input ──────────────────────────────────────────────────────────

function BankNameInput({ value, onChange, label = "Bank / Issuer Name" }: {
  value: string; onChange: (v: string) => void; label?: string;
}) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState(value);
  const [style, setStyle]         = useState<CSSProperties>({});

  // Sync query when value prop changes (e.g. edit modal reopened with different account)
  const prevValue = useRef(value);
  if (prevValue.current !== value) { prevValue.current = value; if (!open) setQuery(value); }
  const inputRef                  = useRef<HTMLInputElement>(null);
  const filtered                  = INDIAN_BANKS.filter(b => b.toLowerCase().includes(query.toLowerCase()));

  const reposition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setStyle({ position: "fixed", top: r.bottom + 4, left: r.left, width: r.width, zIndex: 9999 });
  };

  return (
    <div className="relative">
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}</label>
      <input ref={inputRef} value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); reposition(); }}
        onFocus={() => { setOpen(true); reposition(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search or type…"
        className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/50 outline-none focus:border-indigo-500 transition-all" />
      {open && filtered.length > 0 && (
        <div style={style} className="bg-card border border-border rounded-xl max-h-52 overflow-y-auto shadow-2xl">
          {filtered.map(b => (
            <button key={b} type="button" onMouseDown={() => { onChange(b); setQuery(b); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/70 transition-colors first:rounded-t-xl last:rounded-b-xl">
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TxnRef type ─────────────────────────────────────────────────────────────

type TxnRef = { id: string; amount: number; description?: string; date: string };

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({ account, linkedDebts = [], onAddMoney, onAddExpense, onTransfer, onEdit, onArchive, onAdjust }: {
  account:      WalletAccount;
  linkedDebts?: DebtRecord[];
  onAddMoney:   () => void;
  onAddExpense: () => void;
  onTransfer:   () => void;
  onEdit:       () => void;
  onArchive:    () => void;
  onAdjust:     () => void;
}) {
  const isCreditCard = account.accountType === "CREDIT_CARD";
  const [revealAcctNum, setRevealAcctNum] = useState(false);

  const pct = isCreditCard
    ? (account.creditLimit && account.creditLimit > 0
        ? Math.min(100, (account.currentBalance / account.creditLimit) * 100) : 0)
    : (account.totalMoneyIn > 0
        ? Math.min(100, (account.totalMoneyOut / account.totalMoneyIn) * 100) : 0);

  const daysUntilDue = account.nextDueDate
    ? Math.ceil((new Date(account.nextDueDate).getTime() - Date.now()) / 86400000) : null;
  const dueUrgent = daysUntilDue !== null && daysUntilDue <= 7;

  if (isCreditCard) {
    // ── Credit card: premium card design ──────────────────────────────────────
    return (
      <div className="relative overflow-hidden rounded-2xl">
        {/* Card gradient body */}
        <div className="bg-gradient-to-br from-rose-600 via-rose-500 to-pink-600 dark:from-rose-700 dark:via-rose-600 dark:to-pink-700 p-5 relative">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-10 -right-2 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

          {/* Top row: icon + chip + actions */}
          <div className="flex items-start justify-between mb-4 relative">
            <div className="flex items-center gap-2">
              <div className="bg-white/15 rounded-lg w-8 h-8 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{account.name}</p>
                <p className="text-[11px] text-white/70">
                  {account.bankName ?? "Credit Card"}
                  {account.accountNumber && <span className="ml-1.5">•••• {account.accountNumber.slice(-4)}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {daysUntilDue !== null && (
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full",
                  dueUrgent ? "bg-red-900/60 text-red-200" : "bg-white/15 text-white/80")}>
                  {daysUntilDue < 0 ? "Overdue" : daysUntilDue === 0 ? "Due today" : `Due in ${daysUntilDue}d`}
                </span>
              )}
              <button onClick={onEdit} className="w-7 h-7 rounded-lg text-white/60 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onArchive} title="Archive account" className="w-7 h-7 rounded-lg text-white/60 hover:text-amber-200 hover:bg-amber-900/30 flex items-center justify-center transition-all">
                <Archive className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chip + WiFi icon row */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-5 rounded bg-amber-300/70 border border-amber-200/40 flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5 w-3 h-3">
                {[...Array(4)].map((_, i) => <div key={i} className="bg-amber-600/60 rounded-[1px]" />)}
              </div>
            </div>
            <Wifi className="w-3.5 h-3.5 text-white/50 rotate-90" />
          </div>

          {/* Outstanding balance */}
          <div className="mb-1">
            <p className="text-xs text-white/60 uppercase tracking-widest mb-0.5">Outstanding</p>
            <p className="text-2xl font-bold text-white tabular-nums">{formatCurrency(account.currentBalance)}</p>
          </div>

          {/* Limit + available */}
          {account.creditLimit && (
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="text-white/60">Limit <span className="text-white/90 font-medium">{formatCurrency(account.creditLimit)}</span></span>
              <span className="text-emerald-200">Available <span className="font-semibold">{formatCurrency(account.availableCredit ?? 0)}</span></span>
            </div>
          )}

          {/* Utilisation bar */}
          {account.creditLimit && (
            <div className="mt-3">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                  pct > 90 ? "bg-red-300" : pct > 70 ? "bg-amber-300" : "bg-white/70")}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-white/50 mt-0.5">{pct.toFixed(0)}% used</p>
            </div>
          )}

          {/* Statement / due dates */}
          {(account.nextStatementDate || account.nextDueDate) && (
            <div className="flex items-center gap-4 mt-3 text-[11px] text-white/60">
              {account.nextStatementDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Statement {formatDate(account.nextStatementDate)}
                </span>
              )}
              {account.nextDueDate && (
                <span className={cn("flex items-center gap-1", dueUrgent ? "text-red-200 font-semibold" : "")}>
                  <AlertCircle className="w-3 h-3" /> Due {formatDate(account.nextDueDate)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons below card */}
        <div className="bg-card border border-border border-t-0 rounded-b-2xl p-3 flex gap-2">
          <button onClick={onAddExpense}
            className="flex-1 h-8 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-all">
            Charge Card
          </button>
          <button onClick={onTransfer}
            className="flex-1 h-8 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all">
            Pay Bill
          </button>
        </div>

        {/* Recent transactions removed — see Transactions page */}
        {false && (
          <div>
            {account.recentTransactions.length > 2 && (
              <button onClick={() => {}}
                className="mt-1 w-full text-xs text-muted-foreground/50 hover:text-muted-foreground py-1 transition-colors flex items-center justify-center gap-1">
                <ChevronDown className="w-3 h-3" />
                {`View ${account.recentTransactions.length - 2} more`}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Regular account card ──────────────────────────────────────────────────
  const meta = ACCOUNT_TYPE_META[account.accountType];
  const Icon = meta.icon;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-border/80 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", meta.bg)}>
            <Icon className={cn("w-5 h-5", meta.color)} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{account.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {account.bankName && account.bankName !== account.name && <p className="text-xs text-muted-foreground">{account.bankName}</p>}
              {account.accountNumber && (
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground/50 font-mono">
                    {revealAcctNum ? account.accountNumber : `•••• ${account.accountNumber.slice(-4)}`}
                  </p>
                  <button onClick={() => setRevealAcctNum(v => !v)}
                    className="text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                    {revealAcctNum ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="Download statement"
            onClick={async () => {
              try {
                const pmMap: Record<string, string> = {
                  CASH_WALLET: "CASH", BANK_ACCOUNT: "BANK_ACCOUNT",
                  CREDIT_CARD: "CREDIT_CARD", EMERGENCY_FUND: "BANK_ACCOUNT",
                };
                const expectedPm = pmMap[account.accountType] ?? "";
                const [expRes, transfers] = await Promise.all([
                  expensesApi.getExpenses({ size: 500, sortDir: "desc" }),
                  apiClient.get<{ data: { data: { id: string; transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }[] } }>("/accounts/transfers?size=200"),
                ]);
                const allExpenses = expRes.data ?? [];
                const expenses = allExpenses.filter((e: { accountId?: string; paymentMethod?: string }) =>
                  e.accountId === account.id ||
                  (!e.accountId && e.paymentMethod === expectedPm)
                );
                const txfrs     = (transfers.data?.data?.data ?? []).filter((t: { fromAccountId: string; toAccountId?: string }) =>
                  t.fromAccountId === account.id || t.toAccountId === account.id);
                const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
                const totalOut = expenses.reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0);

                const expRows = expenses.length > 0
                  ? expenses.map((e: { expenseDate: string; categoryName?: string; description?: string; amount: number }) =>
                    `<tr><td>${e.expenseDate}</td><td>${e.categoryName ?? "—"}</td><td>${e.description ?? "—"}</td><td style="color:#dc2626;text-align:right">${fmt(Number(e.amount))}</td></tr>`
                  ).join("")
                  : `<tr><td colspan="4" style="color:#999;text-align:center;padding:12px">No expenses for this account</td></tr>`;

                const txfrRows = txfrs.length > 0
                  ? txfrs.map((t: { transferDate: string; amount: number; description?: string; fromAccountId: string; toAccountId?: string }) => {
                      const isIn = t.toAccountId === account.id;
                      return `<tr><td>${t.transferDate}</td><td>${t.description ?? "—"}</td><td style="color:${isIn ? "#16a34a" : "#dc2626"};text-align:right">${isIn ? "+" : "−"}${fmt(Number(t.amount))}</td></tr>`;
                    }).join("")
                  : `<tr><td colspan="3" style="color:#999;text-align:center;padding:12px">No transfers</td></tr>`;

                const th = (label: string, right = false) =>
                  `<th style="padding:7px 10px;text-align:${right ? "right" : "left"};border-bottom:2px solid #e0e0e0">${label}</th>`;

                const html = `
                  <h1 style="font-size:18px;font-weight:700;margin-bottom:4px">${account.name} — Statement</h1>
                  <p style="color:#666;font-size:12px;margin-bottom:20px">${account.bankName ? account.bankName + " · " : ""}Generated ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
                  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
                    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
                      <div style="font-size:11px;color:#888;margin-bottom:4px">Current Balance</div>
                      <div style="font-size:16px;font-weight:700">${fmt(Number(account.currentBalance))}</div>
                    </div>
                    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
                      <div style="font-size:11px;color:#888;margin-bottom:4px">Total In</div>
                      <div style="font-size:16px;font-weight:700;color:#16a34a">${fmt(Number(account.totalMoneyIn))}</div>
                    </div>
                    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:12px">
                      <div style="font-size:11px;color:#888;margin-bottom:4px">Total Out</div>
                      <div style="font-size:16px;font-weight:700;color:#dc2626">${fmt(Number(account.totalMoneyOut))}</div>
                    </div>
                  </div>
                  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#444;margin-bottom:8px">Expenses (${expenses.length})</p>
                  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
                    <thead><tr style="background:#f5f5f5">${th("Date")}${th("Category")}${th("Description")}${th("Amount", true)}</tr></thead>
                    <tbody>${expRows}</tbody>
                    ${expenses.length > 0 ? `<tfoot><tr style="font-weight:700"><td colspan="3" style="padding:7px 10px">Total Spent</td><td style="padding:7px 10px;text-align:right;color:#dc2626">${fmt(totalOut)}</td></tr></tfoot>` : ""}
                  </table>
                  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#444;margin-bottom:8px">Transfers (${txfrs.length})</p>
                  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px">
                    <thead><tr style="background:#f5f5f5">${th("Date")}${th("Description")}${th("Amount", true)}</tr></thead>
                    <tbody>${txfrRows}</tbody>
                  </table>`;

                const win = window.open("", "_blank", "width=860,height=650");
                if (!win) { toast.error("Allow pop-ups to generate statement."); return; }
                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${account.name} Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;color:#111;padding:28px 36px}@media print{button{display:none}}</style></head><body>${html}<br/><button onclick="window.print()" style="padding:8px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">Save as PDF</button></body></html>`);
                win.document.close();
              } catch { toast.error("Failed to generate statement"); }
            }}
            className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={onAdjust} title="Adjust balance" className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-teal-500 hover:bg-teal-500/10 flex items-center justify-center transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit} className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted flex items-center justify-center transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onArchive} title="Archive account" className="w-7 h-7 rounded-lg text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-all">
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-1">
        <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-0.5">Balance</p>
        <p className={cn("text-2xl font-bold tabular-nums",
          account.currentBalance < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
          {formatCurrency(account.currentBalance)}
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs mb-3">
        <span className="flex items-center gap-1 font-semibold text-emerald-500 dark:text-emerald-400">
          <TrendingUp className="w-3 h-3" /> {formatCurrency(account.totalMoneyIn)}
        </span>
        <span className="flex items-center gap-1 font-semibold text-red-500 dark:text-red-400">
          <TrendingDown className="w-3 h-3" /> {formatCurrency(account.totalMoneyOut)}
        </span>
      </div>

      {linkedDebts.filter(d => d.status !== "SETTLED").length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(() => {
            const active  = linkedDebts.filter(d => d.status !== "SETTLED");
            const lentAmt = active.filter(d => d.type === "LENT").reduce((s, d) => s + d.amountRemaining, 0);
            const borAmt  = active.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);
            return (
              <>
                {lentAmt > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-medium">
                    ↑ {formatCurrency(lentAmt)} lent out
                  </span>
                )}
                {borAmt > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                    ↓ {formatCurrency(borAmt)} borrowed
                  </span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {account.totalMoneyIn > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground/60 uppercase tracking-wide">Spending vs income</span>
            <span className={cn("text-xs font-semibold tabular-nums",
              pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-muted-foreground/80")}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all",
              pct > 90 ? "bg-red-500/70" : pct > 70 ? "bg-amber-500/70" : "bg-indigo-500/50")}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <button onClick={onAddMoney}
          className="flex-1 h-8 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all">
          {account.accountType === "EMERGENCY_FUND" ? "Deposit" : "+ Income"}
        </button>
        <button onClick={onAddExpense}
          className="flex-1 h-8 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all">
          {account.accountType === "EMERGENCY_FUND" ? "Withdraw" : "− Expense"}
        </button>
        <button onClick={onTransfer}
          className="flex-1 h-8 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all">
          ↕ Transfer
        </button>
      </div>

      <Link href={`/expenses?tab=transfers&accountId=${account.id}`}
        className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground/60 hover:text-indigo-500 transition-colors">
        View transfers →
      </Link>

    </div>
  );
}

// ─── Shared recent-transaction list ──────────────────────────────────────────

function RecentTxnList({ txns, showAll, onEditIncome, onDeleteIncome, onEditExpense, onDeleteExpense, onEditTransfer, onDeleteTransfer }: {
  txns:             WalletAccount["recentTransactions"];
  showAll:          boolean;
  onEditIncome:     (txn: TxnRef) => void;
  onDeleteIncome:   (id: string) => void;
  onEditExpense:    (txn: TxnRef) => void;
  onDeleteExpense:  (id: string) => void;
  onEditTransfer:   (txn: TxnRef) => void;
  onDeleteTransfer: (id: string) => void;
}) {
  const visible = showAll ? txns : txns.slice(0, 2);
  return (
    <div className="space-y-0.5">
      {visible.map(t => (
        <div key={t.id} className="group/txn flex items-center gap-2 py-1.5 rounded-lg px-1 hover:bg-muted/50 transition-colors">
          <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs", TXN_BG[t.type])}>
            {t.type === "INCOME" && INCOME_SOURCE_ICONS[t.label]
              ? <span>{INCOME_SOURCE_ICONS[t.label]}</span>
              : <span className={cn("font-bold", TXN_COLORS[t.type])}>{TXN_SIGN[t.type]}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs text-foreground truncate">
                {t.description || INCOME_SOURCES.find(s => s.value === t.label)?.label || t.label}
              </p>
              {t.type === "INCOME" && t.source === "INVESTMENT" && (
                <span className={cn("shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                  t.label === "DIVIDEND" ? "bg-amber-500/15 text-amber-500 dark:text-amber-400" : "bg-sky-500/15 text-sky-500 dark:text-sky-400")}>
                  {t.label === "DIVIDEND" ? "Div" : "Int"}
                </span>
              )}
              {(t.type === "DEBT_OUT" || t.type === "DEBT_IN") && (
                <span className={cn("shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
                  t.type === "DEBT_OUT" ? "bg-orange-500/15 text-orange-500 dark:text-orange-400" : "bg-teal-500/15 text-teal-500 dark:text-teal-400")}>
                  {t.type === "DEBT_OUT" ? "Debt Out" : "Debt In"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground/50">{formatDate(t.date)}</p>
          </div>
          <span className={cn("text-xs font-semibold tabular-nums shrink-0", TXN_COLORS[t.type])}>
            {TXN_SIGN[t.type]}{formatCurrency(t.amount)}
          </span>
          <div className="opacity-0 group-hover/txn:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
            {t.type === "INCOME" && <>
              <button onClick={() => onEditIncome({ id: t.id, amount: t.amount, description: t.description, date: t.date })}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => onDeleteIncome(t.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </>}
            {t.type === "EXPENSE" && <>
              <button onClick={() => onEditExpense({ id: t.id, amount: t.amount, description: t.description, date: t.date })}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => onDeleteExpense(t.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </>}
            {(t.type === "TRANSFER_IN" || t.type === "TRANSFER_OUT") && <>
              <button onClick={() => onEditTransfer({ id: t.id, amount: t.amount, description: t.description, date: t.date })}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => onDeleteTransfer(t.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

type FeedKind = "ALL" | "INCOME" | "EXPENSE" | "TRANSFER";

function ActivityFeed({ transfers, incomes, expenses, accounts, onEditIncome, onDeleteIncome, onEditExpense, onDeleteExpense, onEditTransfer, onDeleteTransfer }: {
  transfers:        import("@/features/accounts/types/account.types").AccountTransfer[];
  incomes:          import("@/features/income/types/income.types").IncomeEntry[];
  expenses:         Expense[];
  accounts:         WalletAccount[];
  onEditIncome:     (txn: TxnRef) => void;
  onDeleteIncome:   (id: string) => void;
  onEditExpense:    (txn: TxnRef) => void;
  onDeleteExpense:  (id: string) => void;
  onEditTransfer:   (txn: TxnRef) => void;
  onDeleteTransfer: (id: string) => void;
}) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [kind, setKind]           = useState<FeedKind>("ALL");
  const [srcFilter, setSrcFilter] = useState("ALL");

  const accountMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a.name])), [accounts]);

  type ActivityItem =
    | { kind: "income";   date: string; id: string; source: string; amount: number; description?: string; accountName?: string }
    | { kind: "expense";  date: string; id: string; categoryName: string; color?: string; amount: number; description?: string; accountName?: string }
    | { kind: "transfer"; date: string; id: string; from: string; to: string; amount: number; description?: string };

  // All items across all time (client-side month filtering in ActivityFeed)
  const allItems = useMemo<ActivityItem[]>(() => [
    ...incomes.map(i => ({
      kind: "income" as const, date: i.incomeDate, id: i.id,
      source: i.source, amount: i.amount, description: i.description,
      accountName: i.accountId ? accountMap[i.accountId] : undefined,
    })),
    ...expenses.map(e => ({
      kind: "expense" as const, date: e.expenseDate, id: e.id,
      categoryName: e.categoryName ?? "Expense", color: e.categoryColor,
      amount: e.amount, description: e.description,
      accountName: e.accountId ? accountMap[e.accountId] : undefined,
    })),
    ...transfers.map(t => ({
      kind: "transfer" as const, date: t.transferDate, id: t.id,
      from: t.fromAccountName, to: t.toAccountName,
      amount: t.amount, description: t.description,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [incomes, expenses, transfers, accountMap]);

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;

  const navigate = (dir: -1 | 1) => {
    if (dir === 1 && isCurrentMonth) return;
    let m = viewMonth + dir, y = viewYear;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setViewMonth(m); setViewYear(y);
  };

  const monthLabel = (y: number, m: number) =>
    new Date(y, m - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  // Filter to selected month + type + source
  const filtered = useMemo(() => allItems.filter(item => {
    const d = new Date(item.date);
    if (d.getFullYear() !== viewYear || d.getMonth() + 1 !== viewMonth) return false;
    if (kind === "INCOME"   && item.kind !== "income")   return false;
    if (kind === "EXPENSE"  && item.kind !== "expense")  return false;
    if (kind === "TRANSFER" && item.kind !== "transfer")  return false;
    if (srcFilter !== "ALL" && item.kind === "income" && (item as any).source !== srcFilter) return false;
    return true;
  }), [allItems, viewYear, viewMonth, kind, srcFilter]);

  // Unique income sources in current month for filter chips
  const monthSources = useMemo(() =>
    [...new Set(allItems.filter(i => {
      const d = new Date(i.date);
      return d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth && i.kind === "income";
    }).map(i => (i as { source: string }).source))],
    [allItems, viewYear, viewMonth]);

  const totalIn  = filtered.filter(i => i.kind === "income").reduce((s, i) => s + i.amount, 0);
  const totalOut = filtered.filter(i => i.kind === "expense").reduce((s, i) => s + i.amount, 0);
  const totalTxn = filtered.filter(i => i.kind === "transfer").reduce((s, i) => s + i.amount, 0);

  if (allItems.length === 0) return null;

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-violet-500 dark:text-violet-400" />
        <h2 className="text-sm font-semibold text-foreground">Transaction Activity</h2>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-36 text-center">{monthLabel(viewYear, viewMonth)}</span>
          <button onClick={() => navigate(1)} disabled={isCurrentMonth}
            className={cn("w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
              isCurrentMonth ? "bg-muted/40 border-border/40 opacity-30 cursor-not-allowed" : "bg-muted hover:bg-muted/80 border-border")}>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Summary pills */}
        <div className="flex items-center gap-2 text-xs">
          {totalIn  > 0 && <span className="text-emerald-500 dark:text-emerald-400 font-semibold">+{formatCurrencyCompact(totalIn)}</span>}
          {totalOut > 0 && <span className="text-red-500 dark:text-red-400 font-semibold">−{formatCurrencyCompact(totalOut)}</span>}
          {totalTxn > 0 && <span className="text-violet-500 dark:text-violet-400 font-medium">{formatCurrencyCompact(totalTxn)} moved</span>}
          <span className="text-muted-foreground/80">{filtered.length} entries</span>
        </div>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-lg border border-border/60">
          {(["ALL","INCOME","EXPENSE","TRANSFER"] as FeedKind[]).map(k => (
            <button key={k} onClick={() => { setKind(k); if (k !== "INCOME") setSrcFilter("ALL"); }}
              className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {k === "ALL" ? "All" : k === "INCOME" ? "Income" : k === "EXPENSE" ? "Expenses" : "Transfers"}
            </button>
          ))}
        </div>

        {kind === "INCOME" && monthSources.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground/50" />
            {["ALL", ...monthSources].map(src => (
              <button key={src} onClick={() => setSrcFilter(src)}
                className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all",
                  srcFilter === src
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                    : "border-border text-muted-foreground hover:border-indigo-500/30 hover:text-foreground")}>
                {src === "ALL" ? "All sources" : (INCOME_SOURCES.find(s => s.value === src)?.label ?? src)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-foreground">No {kind === "INCOME" ? "income" : kind === "EXPENSE" ? "expenses" : kind === "TRANSFER" ? "transfers" : "activity"} in {monthLabel(viewYear, viewMonth)}</p>
          <button onClick={() => navigate(-1)} className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">
            ← Check previous month
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filtered.map((item, idx) => (
            <div key={item.id}
              className={cn("group/af flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors",
                idx < filtered.length - 1 && "border-b border-border/50")}>
              {item.kind === "income" ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-sm">
                    {INCOME_SOURCE_ICONS[(item as any).source] ?? "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {item.description || INCOME_SOURCES.find(s => s.value === (item as any).source)?.label || (item as any).source}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      {formatDate(item.date)}
                      {(item as any).accountName && <span className="ml-1.5 text-muted-foreground/60">· {(item as any).accountName}</span>}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400 tabular-nums shrink-0">
                    +{formatCurrency(item.amount)}
                  </p>
                  <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                    <button onClick={() => onEditIncome({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteIncome(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              ) : item.kind === "expense" ? (
                <>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: ((item as any).color ?? "#ef4444") + "18" }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: (item as any).color ?? "#ef4444" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.description || (item as any).categoryName}</p>
                    <p className="text-xs text-muted-foreground/80">
                      {formatDate(item.date)}
                      {(item as any).accountName && <span className="ml-1.5 text-muted-foreground/60">· {(item as any).accountName}</span>}
                      <span className="ml-1.5 text-xs font-medium" style={{ color: (item as any).color ?? "#ef4444" }}>{(item as any).categoryName}</span>
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-red-500 dark:text-red-400 tabular-nums shrink-0">
                    −{formatCurrency(item.amount)}
                  </p>
                  <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                    <button onClick={() => onEditExpense({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteExpense(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{(item as any).from} → {(item as any).to}</p>
                    <p className="text-xs text-muted-foreground/80">
                      {formatDate(item.date)}{item.description ? ` · ${item.description}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-violet-500 dark:text-violet-400 tabular-nums shrink-0">
                    {formatCurrency(item.amount)}
                  </p>
                  <div className="opacity-0 group-hover/af:opacity-100 flex items-center gap-0.5 transition-all shrink-0">
                    <button onClick={() => onEditTransfer({ id: item.id, amount: item.amount, description: item.description, date: item.date })}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteTransfer(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ModalType = "none" | "create" | "addMoney" | "addExpense" | "transfer" | "edit";
type ConfirmState = { title: string; message: string; onConfirm: () => void } | null;

export default function AccountsPage() {
  const now = new Date();
  const [modal, setModal]              = useState<ModalType>("none");
  const [bankInput, setBankInput]      = useState("");
  const [editAccount, setEditAccount]  = useState<WalletAccount | null>(null);
  const [preAccount, setPreAccount]    = useState<WalletAccount | null>(null);
  const [showCCDetails, setShowCCDetails] = useState(false);
  const [confirm, setConfirm]          = useState<ConfirmState>(null);
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringDay,  setRecurringDay]  = useState("1");

  const [transferPage, setTransferPage]      = useState(0);
  const [showArchived, setShowArchived]      = useState(false);
  const { data: accounts = [], isLoading }   = useAccounts();
  const { data: archivedAccounts = [] }      = useArchivedAccounts();
  const { data: transfersPage }              = useTransfers(transferPage);
  const transfers                          = transfersPage?.data ?? [];
  const transferMeta                       = transfersPage?.meta;
  const { data: allIncomes = [] }          = useIncome();
  const { data: allDebts  = [] }           = useDebts();
  const { data: categories = [] }          = useCategories("EXPENSE");
  const { data: incomeCategories = [] }    = useCategories("INCOME");
  const { data: expenseData }              = useExpenses({ size: 500, sortDir: "desc" });
  const allExpenses                        = expenseData?.data ?? [];

  const [adjustAccount, setAdjustAccount] = useState<WalletAccount | null>(null);
  const [adjustTarget,  setAdjustTarget]  = useState("");

  const { mutate: createAccount, isPending: creating }        = useCreateAccount();
  const { mutate: updateAccount, isPending: updating }        = useUpdateAccount();
  const { mutate: doAdjustBalance, isPending: adjusting }     = useAdjustBalance();
  const { mutate: deleteAccount }                             = useDeleteAccount();
  const { mutate: archiveAccount }                            = useArchiveAccount();
  const { mutate: unarchiveAccount }                          = useUnarchiveAccount();
  const { mutate: doTransfer, isPending: transferring }       = useTransfer();
  const { mutate: deleteTransfer }                            = useDeleteTransfer();
  const { mutate: createIncome, isPending: addingMoney }      = useCreateIncome();
  const { mutate: createRecurringIncome }                     = useCreateRecurringIncome();
  const { mutate: deleteIncome }                              = useDeleteIncome();
  const { mutate: updateIncome, isPending: updatingIncome }   = useUpdateIncome();
  const { mutate: createExpense, isPending: addingExpense }   = useCreateExpense();
  const { mutate: updateExpense, isPending: updatingExpense } = useUpdateExpense();
  const { mutate: deleteExpense }                             = useDeleteExpense();
  const { mutate: updateTransfer, isPending: updatingTransfer } = useUpdateTransfer();

  const [editIncomeTxn,   setEditIncomeTxn]   = useState<TxnRef | null>(null);
  const [editExpenseTxn,  setEditExpenseTxn]  = useState<TxnRef | null>(null);
  const [editTransferTxn, setEditTransferTxn] = useState<TxnRef | null>(null);

  const editIncomeForm   = useForm<{ amount: number; description: string }>({ defaultValues: { amount: 0, description: "" } });
  const editExpenseForm  = useForm<{ amount: number; description: string }>({ defaultValues: { amount: 0, description: "" } });
  const editTransferForm = useForm<{ amount: number; description: string }>({ defaultValues: { amount: 0, description: "" } });

  const expenseForm = useForm<AddExpenseForm>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: { expenseDate: now.toISOString().split("T")[0] },
  });
  const createForm = useForm<CreateAccountForm>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: { accountType: "CASH_WALLET", name: "Cash Wallet", openingBalance: undefined as any },
  });
  const moneyForm = useForm<AddMoneyForm>({
    resolver: zodResolver(addMoneySchema),
    defaultValues: { source: "SALARY", incomeDate: now.toISOString().split("T")[0] },
  });
  const transferForm = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
    defaultValues: { transferDate: now.toISOString().split("T")[0] },
  });

  const cashAccounts      = accounts.filter(a => a.accountType === "CASH_WALLET");
  const bankAccounts      = accounts.filter(a => a.accountType === "BANK_ACCOUNT");
  const emergencyAccounts = accounts.filter(a => a.accountType === "EMERGENCY_FUND");
  const creditCards       = accounts.filter(a => a.accountType === "CREDIT_CARD");

  const totalBalance   = [...cashAccounts, ...bankAccounts].reduce((s, a) => s + a.currentBalance, 0);
  const emergencyBal   = emergencyAccounts.reduce((s, a) => s + a.currentBalance, 0);
  const creditCardDebt = creditCards.reduce((s, a) => s + Math.max(0, a.currentBalance), 0);
  const totalIn        = accounts.filter(a => a.accountType !== "CREDIT_CARD").reduce((s, a) => s + a.totalMoneyIn, 0);
  const totalOut       = accounts.filter(a => a.accountType !== "CREDIT_CARD").reduce((s, a) => s + a.totalMoneyOut, 0);

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));
  const accountOptions  = accounts.map(a => ({
    value: a.id,
    label: `${a.name}${a.bankName ? ` (${a.bankName})` : ""}${a.accountNumber ? ` ·· ${a.accountNumber.slice(-4)}` : ""} — ${
      a.accountType === "CREDIT_CARD" ? `${formatCurrencyCompact(a.currentBalance)} due` : formatCurrencyCompact(a.currentBalance)
    }`,
  }));
  const nonCreditOptions = accountOptions.filter((_, i) => accounts[i].accountType !== "CREDIT_CARD");

  const askConfirm = (title: string, message: string, onConfirm: () => void) =>
    setConfirm({ title, message, onConfirm });

  const openCreate = (type: AccountType) => {
    setBankInput("");
    setShowCCDetails(false);
    createForm.reset({
      accountType: type, openingBalance: undefined as any,
      name: type === "CASH_WALLET" ? "Cash Wallet" : type === "EMERGENCY_FUND" ? "Emergency Fund" : "",
    });
    setModal("create");
  };

  const openAddMoney = (account?: WalletAccount) => {
    setPreAccount(account ?? null);
    moneyForm.reset({ source: "SALARY", incomeDate: now.toISOString().split("T")[0], accountId: account?.id ?? "" });
    setMakeRecurring(false);
    setRecurringDay("1");
    setModal("addMoney");
  };

  const [lockedExpenseAccount, setLockedExpenseAccount] = useState<WalletAccount | null>(null);

  const openAddExpense = (account?: WalletAccount) => {
    setLockedExpenseAccount(account ?? null);
    expenseForm.reset({ accountId: account?.id ?? "", expenseDate: now.toISOString().split("T")[0] });
    setModal("addExpense");
  };

  const openTransfer = (account?: WalletAccount, payBill = false) => {
    setPreAccount(account ?? null);
    transferForm.reset({
      fromAccountId: payBill ? "" : (account?.id ?? ""),
      toAccountId:   payBill ? (account?.id ?? "") : "",
      transferDate:  now.toISOString().split("T")[0],
    });
    setModal("transfer");
  };

  const openEdit = (account: WalletAccount) => {
    setEditAccount(account);
    setBankInput(account.bankName ?? "");
    setShowCCDetails(!!(account.creditLimit || account.statementDay));
    createForm.reset({
      accountType: account.accountType, name: account.name,
      bankName: account.bankName, accountNumber: account.accountNumber,
      openingBalance: account.openingBalance,
      creditLimit: account.creditLimit, statementDay: account.statementDay,
      paymentDueDay: account.paymentDueDay, apr: account.apr,
    });
    setModal("edit");
  };

  const close = () => { setModal("none"); setEditAccount(null); setPreAccount(null); setLockedExpenseAccount(null); };

  const openEditIncome = (txn: TxnRef) => {
    setEditIncomeTxn(txn);
    editIncomeForm.reset({ amount: txn.amount, description: txn.description ?? "" });
  };
  const onEditIncomeSubmit = (v: { amount: number; description: string }) => {
    if (!editIncomeTxn) return;
    const d = new Date(editIncomeTxn.date);
    updateIncome({ id: editIncomeTxn.id, payload: { amount: Number(v.amount), description: v.description || undefined,
      incomeDate: editIncomeTxn.date, periodMonth: d.getMonth() + 1, periodYear: d.getFullYear() } },
      { onSuccess: () => setEditIncomeTxn(null) });
  };

  const openEditExpense = (txn: TxnRef) => {
    setEditExpenseTxn(txn);
    editExpenseForm.reset({ amount: txn.amount, description: txn.description ?? "" });
  };
  const onEditExpenseSubmit = (v: { amount: number; description: string }) => {
    if (!editExpenseTxn) return;
    updateExpense({ id: editExpenseTxn.id, payload: { amount: Number(v.amount), description: v.description || undefined } },
      { onSuccess: () => setEditExpenseTxn(null) });
  };

  const openEditTransfer = (txn: TxnRef) => {
    setEditTransferTxn(txn);
    editTransferForm.reset({ amount: txn.amount, description: txn.description ?? "" });
  };
  const onEditTransferSubmit = (v: { amount: number; description: string }) => {
    if (!editTransferTxn) return;
    updateTransfer({ id: editTransferTxn.id, payload: { amount: Number(v.amount), description: v.description || undefined } },
      { onSuccess: () => setEditTransferTxn(null) });
  };

  const onCreateSubmit = (v: CreateAccountForm) => {
    const isCC = v.accountType === "CREDIT_CARD";
    const isBankOrCC = v.accountType === "BANK_ACCOUNT" || isCC;
    createAccount({
      ...v,
      bankName:      isBankOrCC ? bankInput || undefined : undefined,
      accountNumber: isBankOrCC ? v.accountNumber || undefined : undefined,
    } as Parameters<typeof createAccount>[0], { onSuccess: close });
  };

  const onEditSubmit = (v: CreateAccountForm) => {
    if (!editAccount) return;
    const isCC = editAccount.accountType === "CREDIT_CARD";
    const isBankOrCC = editAccount.accountType === "BANK_ACCOUNT" || isCC;
    const { openingBalance: _ob, ...rest } = v;
    updateAccount({ id: editAccount.id, payload: {
      ...rest,
      name:          v.name || editAccount.name,
      bankName:      isBankOrCC ? bankInput || undefined : undefined,
      accountNumber: isBankOrCC ? v.accountNumber || undefined : undefined,
    } }, { onSuccess: close });
  };

  const onAddMoneySubmit = (v: AddMoneyForm) => {
    const d = new Date(v.incomeDate);
    const target = accounts.find(a => a.id === v.accountId);
    createIncome({ accountId: v.accountId, source: v.source,
      paymentMode: target?.accountType === "CASH_WALLET" ? "CASH" : "BANK_ACCOUNT",
      amount: Number(v.amount), description: v.description, incomeDate: v.incomeDate,
      periodMonth: d.getMonth() + 1, periodYear: d.getFullYear() }, {
      onSuccess: () => {
        if (makeRecurring) {
          const day = Math.min(31, Math.max(0, Number(recurringDay)));
          createRecurringIncome({
            accountId:   v.accountId,
            source:      v.source,
            amount:      Number(v.amount),
            description: v.description,
            dayOfMonth:  day,
          });
        }
        close();
      },
    });
  };

  const onAddExpenseSubmit = (v: AddExpenseForm) => {
    const target = accounts.find(a => a.id === v.accountId);
    const paymentMethod = target?.accountType === "CASH_WALLET" ? "CASH"
      : target?.accountType === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK_ACCOUNT";
    createExpense({ accountId: v.accountId, categoryId: v.categoryId, amount: Number(v.amount),
      description: v.description, expenseDate: v.expenseDate, paymentMethod }, { onSuccess: close });
  };

  const onTransferSubmit = (v: TransferForm) => {
    if (v.fromAccountId === v.toAccountId) {
      transferForm.setError("toAccountId", { message: "Cannot transfer to same account" });
      return;
    }
    doTransfer({ fromAccountId: v.fromAccountId, toAccountId: v.toAccountId,
      amount: Number(v.amount), description: v.description, transferDate: v.transferDate },
      { onSuccess: close });
  };

  // Inline mini modal for editing txn amount/desc
  const TxnEditModal = ({ form, title, onSubmit, onClose, isPending }: {
    form: ReturnType<typeof useForm<{ amount: number; description: string }>>;
    title: string; onSubmit: (v: any) => void; onClose: () => void; isPending: boolean;
  }) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormCurrencyInput label="Amount" {...form.register("amount", { valueAsNumber: true })} />
          <FormInput label="Description" placeholder="Add a note…" {...form.register("description")} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={isPending}
              className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
              {isPending ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const watchedType           = createForm.watch("accountType");
  const activeType            = modal === "create" ? watchedType : (editAccount?.accountType ?? watchedType);
  const isCCForm              = activeType === "CREDIT_CARD";
  const isBankForm            = activeType === "BANK_ACCOUNT";
  const isSimpleType          = activeType === "CASH_WALLET" || activeType === "EMERGENCY_FUND";

  const expenseAccountId      = expenseForm.watch("accountId");
  const expenseAmount         = expenseForm.watch("amount");
  const expenseAccount        = accounts.find(a => a.id === expenseAccountId);
  const canOverdraft          = expenseAccount?.accountType === "BANK_ACCOUNT" || expenseAccount?.accountType === "CASH_WALLET";
  const expenseAmountNum      = Number(expenseAmount) || 0;
  const balanceAfterExpense   = canOverdraft ? (expenseAccount!.currentBalance - expenseAmountNum) : null;
  const willOverdraft         = balanceAfterExpense !== null && balanceAfterExpense < 0;

  const sharedCardProps = (a: WalletAccount) => ({
    onEdit:    () => openEdit(a),
    onAdjust:  () => { setAdjustAccount(a); setAdjustTarget(String(a.currentBalance)); },
    onArchive: () => askConfirm("Archive Account", `Archive "${a.name}"? It will be hidden from all views but all history is preserved.`, () => archiveAccount(a.id)),
  });

  return (
    <div className="flex flex-col flex-1">
      <Header title="Accounts" />

      {confirm && (
        <ConfirmDialog open title={confirm.title} description={confirm.message}
          confirmLabel={confirm.title.startsWith("Archive") ? "Archive" : confirm.title.startsWith("Restore") ? "Restore" : "Delete"}
          danger={!confirm.title.startsWith("Restore")}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}

      {adjustAccount && (() => {
        const target     = parseFloat(adjustTarget) || 0;
        const current    = adjustAccount.currentBalance;
        const diff       = target - current;
        const isPositive = diff > 0;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setAdjustAccount(null)}>
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">Adjust Balance</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{adjustAccount.name}</p>
                </div>
                <button onClick={() => setAdjustAccount(null)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-muted/40 rounded-xl p-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App balance</span>
                  <span className="font-medium tabular-nums">{formatCurrency(current)}</span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <label className="text-xs font-medium text-muted-foreground">Actual balance (from your bank)</label>
                <input
                  type="number"
                  value={adjustTarget}
                  onChange={e => setAdjustTarget(e.target.value)}
                  placeholder="Enter real balance"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                />
              </div>

              {adjustTarget && !isNaN(parseFloat(adjustTarget)) && diff !== 0 && (
                <div className={cn("rounded-xl px-3 py-2 text-sm mb-4 flex items-center justify-between",
                  isPositive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400")}>
                  <span>{isPositive ? "Income adjustment" : "Expense adjustment"}</span>
                  <span className="font-semibold tabular-nums">{isPositive ? "+" : "−"}{formatCurrency(Math.abs(diff))}</span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground/80 mb-4">
                A &quot;Balance Adjustment&quot; {isPositive ? "income" : "expense"} entry will be created to correct the difference.
              </p>

              <div className="flex gap-2">
                <button onClick={() => setAdjustAccount(null)}
                  className="flex-1 h-10 rounded-xl text-sm border border-border text-muted-foreground hover:bg-muted transition-all">
                  Cancel
                </button>
                <button
                  disabled={adjusting || !adjustTarget || isNaN(parseFloat(adjustTarget)) || diff === 0}
                  onClick={() => doAdjustBalance(
                    { id: adjustAccount.id, targetBalance: target },
                    { onSuccess: () => setAdjustAccount(null) }
                  )}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-50">
                  {adjusting ? "Adjusting…" : "Adjust Balance"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editIncomeTxn   && <TxnEditModal form={editIncomeForm}   title="Edit Income"   onSubmit={onEditIncomeSubmit}   onClose={() => setEditIncomeTxn(null)}   isPending={updatingIncome} />}
      {editExpenseTxn  && <TxnEditModal form={editExpenseForm}  title="Edit Expense"  onSubmit={onEditExpenseSubmit}  onClose={() => setEditExpenseTxn(null)}  isPending={updatingExpense} />}
      {editTransferTxn && <TxnEditModal form={editTransferForm} title="Edit Transfer" onSubmit={onEditTransferSubmit} onClose={() => setEditTransferTxn(null)} isPending={updatingTransfer} />}

      {/* ── Modals ── */}
      {modal !== "none" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={close}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* CREATE / EDIT */}
            {(modal === "create" || modal === "edit") && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground">
                    {modal === "edit"
                      ? (isCCForm ? "Edit Card" : "Edit Account")
                      : "New Account"}
                  </h3>
                  <button onClick={close} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={createForm.handleSubmit(modal === "edit" ? onEditSubmit : onCreateSubmit)} className="space-y-4">
                  {modal === "create" && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["CASH_WALLET","BANK_ACCOUNT","EMERGENCY_FUND","CREDIT_CARD"] as AccountType[]).map(t => {
                        const m = ACCOUNT_TYPE_META[t];
                        const Icon = m.icon;
                        const singleton    = t === "CASH_WALLET" || t === "EMERGENCY_FUND";
                        const alreadyExists = singleton && accounts.some(a => a.accountType === t);
                        return (
                          <button key={t} type="button" disabled={alreadyExists}
                            onClick={() => { createForm.setValue("accountType", t);
                              createForm.setValue("name", t === "CASH_WALLET" ? "Cash Wallet" : t === "EMERGENCY_FUND" ? "Emergency Fund" : ""); }}
                            className={cn("flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all",
                              alreadyExists ? "opacity-40 cursor-not-allowed bg-muted border-border text-muted-foreground"
                                : watchedType === t
                                  ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400"
                                  : "bg-muted/50 border-border text-muted-foreground hover:border-indigo-500/30 hover:text-foreground")}>
                            <Icon className="w-4 h-4 shrink-0" />{m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(isCCForm || isBankForm) && (
                    <BankNameInput
                      label={isCCForm ? "Card Issuer (Bank)" : "Bank Name"}
                      value={bankInput}
                      onChange={v => { setBankInput(v); if (isBankForm) createForm.setValue("name", v || "Bank Account"); }} />
                  )}

                  {/* Name — shown on edit for all non-bank types; on create, hidden for Cash Wallet, Emergency Fund, and Bank Accounts (auto-named) */}
                  {!isBankForm && (modal === "edit" || !isSimpleType) && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                        {isCCForm ? "Card Name" : "Account Name"}
                      </label>
                      <input {...createForm.register("name")}
                        placeholder={isBankForm ? "Auto-filled from bank name" : isCCForm ? "e.g. HDFC Millennia" : "e.g. HDFC Savings"}
                        className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                      {createForm.formState.errors.name && <p className="text-xs text-red-500 mt-1">{createForm.formState.errors.name.message}</p>}
                    </div>
                  )}

                  {isCCForm && (
                    /* Card number + limit on same row for credit cards */
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                          Last 4 digits <span className="text-muted-foreground/60">(optional)</span>
                        </label>
                        <input {...createForm.register("accountNumber")} placeholder="e.g. 4567" maxLength={4}
                          className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Credit Limit</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">₹</span>
                          <input type="number" placeholder="e.g. 100000" onFocus={e => e.target.select()} {...createForm.register("creditLimit")}
                            className="w-full h-10 pl-6 pr-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                        </div>
                      </div>
                    </div>
                  )}

                  {isBankForm && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">
                        Account Number <span className="text-muted-foreground/60">(last 4 digits, optional)</span>
                      </label>
                      <input {...createForm.register("accountNumber")} placeholder="e.g. 4567"
                        className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                    </div>
                  )}

                  {/* Balance: editable on create; read-only info on edit */}
                  {modal === "create" ? (
                    <FormCurrencyInput
                      label={isCCForm ? "Current Outstanding Balance" : "Opening Balance"}
                      placeholder="0"
                      {...createForm.register("openingBalance")}
                      error={createForm.formState.errors.openingBalance?.message} />
                  ) : (
                    <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
                      <span className="text-xs text-muted-foreground font-medium">Current Balance</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(editAccount?.currentBalance ?? 0)}
                      </span>
                    </div>
                  )}

                  {isCCForm && (
                    <>
                      <button type="button" onClick={() => setShowCCDetails(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors w-fit">
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCCDetails && "rotate-180")} />
                        {showCCDetails ? "Hide billing cycle" : "Set billing cycle (statement & due dates)"}
                      </button>
                      {showCCDetails && (
                        <div className="space-y-3 pl-3 border-l-2 border-indigo-500/20">
                          <p className="text-[11px] text-muted-foreground/80">
                            Used to calculate your next statement date and payment due date.
                          </p>
                          <div className="grid grid-cols-2 gap-3 items-end">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Statement Day</label>
                              <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                              <input type="number" min={1} max={28} placeholder="e.g. 15" onFocus={e => e.target.select()}
                                {...createForm.register("statementDay")}
                                className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-0.5 font-medium">Due Day</label>
                              <p className="text-xs text-muted-foreground/60 mb-1.5">Day of month (1–28)</p>
                              <input type="number" min={1} max={28} placeholder="e.g. 5" onFocus={e => e.target.select()}
                                {...createForm.register("paymentDueDay")}
                                className="w-full h-10 px-3 rounded-xl text-sm bg-background border border-border text-foreground placeholder-muted-foreground/40 outline-none focus:border-indigo-500 transition-all" />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={creating || updating}
                      className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
                      {creating || updating ? "Saving…" : modal === "edit" ? "Update" : "Create Account"}
                    </button>
                    <button type="button" onClick={close}
                      className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* ADD INCOME */}
            {modal === "addMoney" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground">Add Income</h3>
                  <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={moneyForm.handleSubmit(onAddMoneySubmit)} className="space-y-4">
                  <FormSelect label="Credit To" options={nonCreditOptions} placeholder="Select account"
                    error={moneyForm.formState.errors.accountId?.message} {...moneyForm.register("accountId")} />
                  <FormSelect label="Category"
                    options={incomeCategories.length > 0
                      ? incomeCategories.map(c => ({ value: incomeCategoryToSource(c.name), label: c.name }))
                      : INCOME_SOURCES}
                    placeholder="Select category"
                    error={moneyForm.formState.errors.source?.message} {...moneyForm.register("source")} />
                  <FormCurrencyInput label="Amount" placeholder="0"
                    error={moneyForm.formState.errors.amount?.message} {...moneyForm.register("amount")} />
                  <Controller control={moneyForm.control} name="incomeDate" render={({ field, fieldState }) => (
                    <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                  )} />
                  <FormInput label="Description (optional)" placeholder="e.g. June salary" {...moneyForm.register("description")} />

                  {/* Recurring toggle */}
                  <div className={cn(
                    "rounded-xl border transition-all",
                    makeRecurring ? "border-indigo-500/30 bg-indigo-500/5" : "border-border bg-muted/30"
                  )}>
                    <button type="button" onClick={() => setMakeRecurring(v => !v)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                      <RefreshCw className={cn("w-4 h-4 shrink-0 transition-colors", makeRecurring ? "text-indigo-500" : "text-muted-foreground/50")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">Repeat monthly</p>
                        <p className="text-xs text-muted-foreground leading-snug">Auto-credit this income on a fixed day every month</p>
                      </div>
                      <div className={cn(
                        "w-9 h-5 rounded-full transition-all shrink-0 relative",
                        makeRecurring ? "bg-indigo-600" : "bg-muted"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                          makeRecurring ? "left-4" : "left-0.5"
                        )} />
                      </div>
                    </button>
                    {makeRecurring && (
                      <div className="px-3.5 pb-3 space-y-1.5">
                        <p className="text-xs text-muted-foreground">Credit day</p>
                        <select
                          value={recurringDay}
                          onChange={e => setRecurringDay(e.target.value)}
                          className="w-full h-9 px-3 rounded-xl text-xs bg-background border border-border text-foreground outline-none focus:border-indigo-500 transition-all">
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

                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={addingMoney}
                      className="flex-1 h-10 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-60">
                      {addingMoney ? "Saving…" : makeRecurring ? "Add & Set Recurring" : "Add Income"}
                    </button>
                    <button type="button" onClick={close} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
                  </div>
                </form>
              </>
            )}

            {/* ADD EXPENSE */}
            {modal === "addExpense" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground">Add Expense</h3>
                  <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={expenseForm.handleSubmit(onAddExpenseSubmit)} className="space-y-4">
                  <div>
                    {lockedExpenseAccount ? (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Account</label>
                        <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-muted/40 border border-border text-sm text-foreground">
                          <span className="text-muted-foreground/50">🔒</span>
                          <span>{lockedExpenseAccount.name}{lockedExpenseAccount.bankName ? ` (${lockedExpenseAccount.bankName})` : ""}</span>
                        </div>
                      </div>
                    ) : (
                      <FormSelect label="Account" options={accountOptions} placeholder="Select account"
                        error={expenseForm.formState.errors.accountId?.message} {...expenseForm.register("accountId")} />
                    )}
                    {expenseAccount && canOverdraft && (
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        Current balance:&nbsp;
                        <span className={cn("font-semibold", expenseAccount.currentBalance < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
                          {formatCurrency(expenseAccount.currentBalance)}
                        </span>
                      </p>
                    )}
                  </div>
                  <FormSelect label="Category" options={categoryOptions} placeholder="Select category"
                    error={expenseForm.formState.errors.categoryId?.message} {...expenseForm.register("categoryId")} />
                  <div>
                    <FormCurrencyInput label="Amount" placeholder="0"
                      error={expenseForm.formState.errors.amount?.message} {...expenseForm.register("amount")} />
                    {willOverdraft && expenseAmountNum > 0 && (
                      <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-500/8 border border-red-500/20 px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">Insufficient balance</p>
                          <p className="text-[11px] text-red-500/80 dark:text-red-400/70 mt-0.5">
                            Balance after this expense will be{" "}
                            <span className="font-bold">{formatCurrency(balanceAfterExpense!)}</span>.
                            {expenseAccount?.accountType === "BANK_ACCOUNT"
                              ? " Your account will go into overdraft."
                              : " Your cash wallet will go negative."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <Controller control={expenseForm.control} name="expenseDate" render={({ field, fieldState }) => (
                    <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                  )} />
                  <FormInput label="Description (optional)" placeholder="e.g. Grocery shopping" {...expenseForm.register("description")} />
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={addingExpense}
                      className={cn("flex-1 h-10 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60",
                        willOverdraft ? "bg-red-700 hover:bg-red-600" : "bg-red-600 hover:bg-red-500")}>
                      {addingExpense ? "Saving…" : willOverdraft ? "Add Anyway" : "Add Expense"}
                    </button>
                    <button type="button" onClick={close} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
                  </div>
                </form>
              </>
            )}

            {/* TRANSFER / PAY BILL */}
            {modal === "transfer" && (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground">
                    {preAccount?.accountType === "CREDIT_CARD" ? "Pay Credit Card Bill" : "Transfer Between Accounts"}
                  </h3>
                  <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4">
                  <FormSelect label="From" options={accountOptions} placeholder="Source account"
                    error={transferForm.formState.errors.fromAccountId?.message} {...transferForm.register("fromAccountId")} />
                  <FormSelect label="To" options={accountOptions} placeholder="Destination account"
                    error={transferForm.formState.errors.toAccountId?.message} {...transferForm.register("toAccountId")} />
                  <FormCurrencyInput label="Amount" placeholder="0"
                    error={transferForm.formState.errors.amount?.message} {...transferForm.register("amount")} />
                  <Controller control={transferForm.control} name="transferDate" render={({ field, fieldState }) => (
                    <FormDatePicker label="Date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} />
                  )} />
                  <FormInput label="Note (optional)" placeholder="e.g. Bill payment" {...transferForm.register("description")} />
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={transferring}
                      className="flex-1 h-10 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-60">
                      {transferring ? "Processing…" : preAccount?.accountType === "CREDIT_CARD" ? "Pay Bill" : "Transfer"}
                    </button>
                    <button type="button" onClick={close} className="h-10 px-4 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-all">Cancel</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-5 lg:p-6 pb-24 lg:pb-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* Banner */}
        <div className="bg-gradient-to-br from-indigo-600/15 to-violet-600/8 border border-indigo-500/20 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
              <p className={cn("text-3xl font-bold tabular-nums", totalBalance < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
                {formatCurrency(totalBalance)}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">Cash &amp; bank accounts</p>
            </div>
            <div className="text-right space-y-1">
              {emergencyBal > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Emergency Fund</p>
                  <p className="text-base font-bold text-amber-500 dark:text-amber-400 tabular-nums">{formatCurrency(emergencyBal)}</p>
                </div>
              )}
              {creditCardDebt > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Card Debt</p>
                  <p className="text-base font-bold text-rose-500 dark:text-rose-400 tabular-nums">{formatCurrency(creditCardDebt)}</p>
                </div>
              )}
            </div>
          </div>
          {(totalIn > 0 || totalOut > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-indigo-500/15">
              <div>
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-0.5">All-time In</p>
                <p className="text-sm font-bold tabular-nums text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />{formatCurrency(totalIn)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground/80 uppercase tracking-wide mb-0.5">All-time Out</p>
                <p className="text-sm font-bold tabular-nums text-red-500 dark:text-red-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />{formatCurrency(totalOut)}
                </p>
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openAddMoney()} disabled={accounts.filter(a => a.accountType !== "CREDIT_CARD").length === 0}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-40">
              <Plus className="w-4 h-4" /> Add Income
            </button>
            <button onClick={() => openAddExpense()} disabled={accounts.length === 0}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-40">
              <MinusCircle className="w-4 h-4" /> Add Expense
            </button>
            <button onClick={() => openTransfer()} disabled={accounts.length < 2}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40">
              <ArrowLeftRight className="w-4 h-4" /> Transfer
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />)}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={Wallet} title="No accounts yet"
            description="Set up your Bank Account, Cash Wallet, Emergency Fund, or add a Credit Card."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                {(["BANK_ACCOUNT","CASH_WALLET","EMERGENCY_FUND","CREDIT_CARD"] as AccountType[]).map(t => {
                  const m = ACCOUNT_TYPE_META[t]; const Icon = m.icon;
                  return (
                    <button key={t} onClick={() => openCreate(t)}
                      className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all">
                      <Icon className="w-4 h-4" /> {m.label}
                    </button>
                  );
                })}
              </div>
            } />
        ) : (
          <>
            {/* Bank Accounts */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <h2 className="text-sm font-semibold text-foreground">Bank Accounts</h2>
                  <span className="text-xs text-muted-foreground">{bankAccounts.length}</span>
                </div>
                <button onClick={() => openCreate("BANK_ACCOUNT")}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Bank
                </button>
              </div>
              {bankAccounts.length > 0 ? (
                <div className={cn("grid gap-4", bankAccounts.length > 1 && "lg:grid-cols-2")}>
                  {bankAccounts.map(a => (
                    <AccountCard key={a.id} account={a}
                      linkedDebts={allDebts.filter(d => d.accountId === a.id)}
                      onAddMoney={() => openAddMoney(a)} onAddExpense={() => openAddExpense(a)} onTransfer={() => openTransfer(a)}
                      {...sharedCardProps(a)} />
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No bank accounts added</p>
                  <button onClick={() => openCreate("BANK_ACCOUNT")} className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">+ Add Bank Account</button>
                </div>
              )}
            </section>

            {/* Cash & Emergency */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <h2 className="text-sm font-semibold text-foreground">Cash &amp; Emergency</h2>
                </div>
                <div className="flex items-center gap-3">
                  {cashAccounts.length === 0 && (
                    <button onClick={() => openCreate("CASH_WALLET")} className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Cash Wallet
                    </button>
                  )}
                  {emergencyAccounts.length === 0 && (
                    <button onClick={() => openCreate("EMERGENCY_FUND")} className="text-xs text-amber-500 dark:text-amber-400 hover:underline flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Emergency Fund
                    </button>
                  )}
                </div>
              </div>
              <div className={cn("grid gap-4", (cashAccounts.length + emergencyAccounts.length) > 1 && "lg:grid-cols-2")}>
                {cashAccounts.length > 0
                  ? cashAccounts.map(a => (
                      <AccountCard key={a.id} account={a}
                        linkedDebts={allDebts.filter(d => d.accountId === a.id)}
                        onAddMoney={() => openAddMoney(a)} onAddExpense={() => openAddExpense(a)} onTransfer={() => openTransfer(a)}
                        {...sharedCardProps(a)} />
                    ))
                  : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                      <p className="text-sm text-muted-foreground">No cash wallet</p>
                      <button onClick={() => openCreate("CASH_WALLET")} className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 hover:underline transition-colors">+ Set up</button>
                    </div>
                }
                {emergencyAccounts.length > 0
                  ? emergencyAccounts.map(a => (
                      <AccountCard key={a.id} account={a}
                        linkedDebts={allDebts.filter(d => d.accountId === a.id)}
                        onAddMoney={() => openAddMoney(a)} onAddExpense={() => openAddExpense(a)} onTransfer={() => openTransfer(a)}
                        {...sharedCardProps(a)} />
                    ))
                  : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                      <p className="text-sm text-muted-foreground">No emergency fund</p>
                      <button onClick={() => openCreate("EMERGENCY_FUND")} className="mt-2 text-xs text-amber-500 dark:text-amber-400 hover:underline transition-colors">+ Set up</button>
                    </div>
                }
              </div>
            </section>

            {/* Credit Cards */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  <h2 className="text-sm font-semibold text-foreground">Credit Cards</h2>
                  {creditCards.length > 0 && <span className="text-xs text-muted-foreground">{creditCards.length}</span>}
                </div>
                <button onClick={() => openCreate("CREDIT_CARD")}
                  className="text-xs text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Add Card
                </button>
              </div>
              {creditCards.length > 0 ? (
                <div className={cn("grid gap-4", creditCards.length > 1 && "lg:grid-cols-2")}>
                  {creditCards.map(a => (
                    <AccountCard key={a.id} account={a}
                      linkedDebts={allDebts.filter(d => d.accountId === a.id)}
                      onAddMoney={() => openAddMoney(a)}
                      onAddExpense={() => openAddExpense(a)}
                      onTransfer={() => openTransfer(a, true)}
                      {...sharedCardProps(a)} />
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No credit cards added</p>
                  <button onClick={() => openCreate("CREDIT_CARD")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Credit Card</button>
                </div>
              )}
            </section>

          </>
        )}

        {/* ── Archived Accounts ── */}
        {archivedAccounts.length > 0 && (
          <section className="mt-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 group"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="font-medium">Archived Accounts ({archivedAccounts.length})</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showArchived && "rotate-180")} />
            </button>

            {showArchived && (
              <div className="space-y-3">
                {archivedAccounts.map(a => {
                  const meta = ACCOUNT_TYPE_META[a.accountType as AccountType] ?? ACCOUNT_TYPE_META.BANK_ACCOUNT;
                  const Icon = meta.icon;
                  return (
                    <div key={a.id} className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", meta.bg)}>
                        <Icon className={cn("w-4 h-4", meta.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.label}{a.bankName ? ` · ${a.bankName}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => askConfirm(
                            "Restore Account",
                            `Restore "${a.name}"? It will appear in your active accounts again.`,
                            () => unarchiveAccount(a.id)
                          )}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => askConfirm(
                            "Delete Account",
                            `Permanently delete "${a.name}"? All transaction history will be lost. This cannot be undone.`,
                            () => deleteAccount(a.id)
                          )}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        </div>
      </main>
    </div>
  );
}
