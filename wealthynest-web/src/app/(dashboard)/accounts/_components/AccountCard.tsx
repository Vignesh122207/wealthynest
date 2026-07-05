"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil, Archive, Download, RefreshCw, TrendingUp, TrendingDown,
  CreditCard, Wifi, AlertCircle, Calendar, Eye, EyeOff,
  Plus, MinusCircle, ArrowLeftRight,
} from "lucide-react";
import { Banknote, Building2, ShieldCheck } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { expensesApi } from "@/features/expenses/api/expenses.api";
import { apiClient } from "@/lib/axios";
import { toast } from "sonner";
import type { AccountType, WalletAccount } from "@/features/accounts/types/account.types";
import type { DebtRecord } from "@/features/debts/types/debt.types";

const ACCOUNT_TYPE_META: Record<AccountType, {
  label: string;
  icon: typeof Banknote;
  color: string;
  bg: string;
  hex: string;
}> = {
  CASH_WALLET:    { label: "Cash Wallet",    icon: Banknote,    color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10", hex: "#34C759" },
  BANK_ACCOUNT:   { label: "Bank Account",   icon: Building2,   color: "text-indigo-500 dark:text-indigo-400",   bg: "bg-indigo-500/10",  hex: "#5856D6" },
  EMERGENCY_FUND: { label: "Emergency Fund", icon: ShieldCheck, color: "text-amber-500 dark:text-amber-400",     bg: "bg-amber-500/10",   hex: "#FF9500" },
  CREDIT_CARD:    { label: "Credit Card",    icon: CreditCard,  color: "text-white",                             bg: "bg-white/15",       hex: "#475569" },
};

async function downloadStatement(account: WalletAccount) {
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
      e.accountId === account.id || (!e.accountId && e.paymentMethod === expectedPm));
    const txfrs = (transfers.data?.data?.data ?? []).filter((t: { fromAccountId: string; toAccountId?: string }) =>
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
  } catch {
    toast.error("Failed to generate statement");
  }
}

interface AccountCardProps {
  account:      WalletAccount;
  linkedDebts?: DebtRecord[];
  onAddMoney:   () => void;
  onAddExpense: () => void;
  onTransfer:   () => void;
  onEdit:       () => void;
  onArchive:    () => void;
  onAdjust:     () => void;
}

export function AccountCard({
  account, linkedDebts = [], onAddMoney, onAddExpense, onTransfer, onEdit, onArchive, onAdjust,
}: AccountCardProps) {
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

  // ── Credit card: premium card design ─────────────────────────────────────────
  if (isCreditCard) {
    return (
      <div className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 animate-fade-in-up">
        {/* Card gradient body */}
        <div className="bg-gradient-to-br from-slate-600 via-slate-700 to-zinc-800 dark:from-slate-700 dark:via-slate-800 dark:to-zinc-900 p-5 relative">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-10 -right-2 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

          {/* Top row: icon + name + actions */}
          <div className="flex items-start justify-between mb-4 relative">
            <div className="flex items-center gap-2">
              <div className="bg-white/15 rounded-xl w-9 h-9 flex items-center justify-center">
                <CreditCard className="w-4.5 h-4.5 text-white" strokeWidth={1.75} />
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
            <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Outstanding</p>
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
                <div className={cn("h-full rounded-full transition-all duration-700",
                  pct > 90 ? "bg-red-300" : pct > 70 ? "bg-amber-300" : "bg-white/70")}
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">{pct.toFixed(0)}% used</p>
            </div>
          )}

          {/* Statement / due dates */}
          {(account.nextStatementDate || account.nextDueDate) && (
            <div className="flex items-center gap-4 mt-3 text-[11px] text-white/60">
              {account.nextStatementDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Statement {new Date(account.nextStatementDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
              {account.nextDueDate && (
                <span className={cn("flex items-center gap-1", dueUrgent ? "text-red-200 font-semibold" : "")}>
                  <AlertCircle className="w-3 h-3" />
                  Due {new Date(account.nextDueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons below card */}
        <div className="bg-card border border-border border-t-0 rounded-b-2xl px-3 py-2.5 flex gap-2">
          <button onClick={onAddExpense}
            className="flex-1 h-8 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-all flex items-center justify-center gap-1.5">
            <MinusCircle className="w-3.5 h-3.5" /> Charge
          </button>
          <button onClick={onTransfer}
            className="flex-1 h-8 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all flex items-center justify-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Pay Bill
          </button>
        </div>
      </div>
    );
  }

  // ── Regular account card ─────────────────────────────────────────────────────
  const meta = ACCOUNT_TYPE_META[account.accountType];
  const Icon = meta.icon;

  const activeDebts = linkedDebts.filter(d => d.status !== "SETTLED");
  const lentAmt  = activeDebts.filter(d => d.type === "LENT").reduce((s, d) => s + d.amountRemaining, 0);
  const borAmt   = activeDebts.filter(d => d.type === "BORROWED").reduce((s, d) => s + d.amountRemaining, 0);

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up flex flex-col">
      {/* Header: icon + name + action icons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: meta.hex + "20" }}>
            <Icon className="w-5 h-5" style={{ color: meta.hex }} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{account.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {account.bankName && account.bankName !== account.name && (
                <p className="text-xs text-muted-foreground">{account.bankName}</p>
              )}
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

        {/* Icon action buttons */}
        <div className="flex items-center gap-0.5">
          <button
            title="Download statement"
            onClick={() => downloadStatement(account)}
            className="w-7 h-7 rounded-lg text-muted-foreground/40 hover:text-indigo-500 hover:bg-indigo-500/10 flex items-center justify-center transition-all">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={onAdjust} title="Adjust balance"
            className="w-7 h-7 rounded-lg text-muted-foreground/40 hover:text-teal-500 hover:bg-teal-500/10 flex items-center justify-center transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit}
            className="w-7 h-7 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted flex items-center justify-center transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onArchive} title="Archive account"
            className="w-7 h-7 rounded-lg text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-all">
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mb-0.5">Balance</p>
        <p className={cn("text-2xl font-bold tabular-nums",
          account.currentBalance < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
          {formatCurrency(account.currentBalance)}
        </p>
      </div>

      {/* In / Out stat tiles */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">In</p>
          </div>
          <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
            {formatCurrency(account.totalMoneyIn)}
          </p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Out</p>
          </div>
          <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
            {formatCurrency(account.totalMoneyOut)}
          </p>
        </div>
      </div>

      {/* Spending bar */}
      {account.totalMoneyIn > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Spending</span>
            <span className={cn("text-xs font-semibold tabular-nums",
              pct > 90 ? "text-red-500" : pct > 70 ? "text-amber-500" : "text-muted-foreground/70")}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700",
              pct > 90 ? "bg-red-500/70" : pct > 70 ? "bg-amber-500/70" : "bg-indigo-500/60")}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Debt badges */}
      {activeDebts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lentAmt > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-medium">
              ↑ {formatCurrency(lentAmt)} lent
            </span>
          )}
          {borAmt > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
              ↓ {formatCurrency(borAmt)} borrowed
            </span>
          )}
        </div>
      )}

      {/* Spacer so action buttons always at bottom */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-1.5 pt-3 border-t border-border/40 mt-3">
        <button onClick={onAddMoney}
          className="h-8 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Income
        </button>
        <button onClick={onAddExpense}
          className="h-8 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all flex items-center justify-center gap-1">
          <MinusCircle className="w-3.5 h-3.5" /> Expense
        </button>
        <Link href={`/expenses?tab=transfers&accountId=${account.id}`}
          className="h-8 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-all flex items-center justify-center gap-1">
          <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
        </Link>
      </div>
    </div>
  );
}
