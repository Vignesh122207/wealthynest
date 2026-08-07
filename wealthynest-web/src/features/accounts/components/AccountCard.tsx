"use client";

import {type CSSProperties, memo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeftRight,
  Banknote,
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  List,
  MoreVertical,
  Receipt,
  Repeat,
  Star,
  TrendingDown,
  TrendingUp,
  Upload,
  Wifi,
} from "lucide-react";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {PURPOSE_CHIP_CLASS, resolvePurposeLabel} from "@/lib/accountPurposeMeta";
import {getLifecycleStatusMeta} from "@/lib/lifecycleStatusMeta";
import {BankLogo} from "@/components/icons/BankLogo";
import {lighten} from "@/components/icons/PremiumIcon";
import {getBankMonogram} from "@/lib/bankLogos";
import {cn, formatDate} from "@/lib/utils";
import {useAmountFormatter} from "@/hooks/useAmountFormatter";
import type {WalletAccount} from "../types/account.types";
import type {DebtRecord} from "@/features/debts/types/debt.types";

type CardAction = { key: string; label: string; icon: React.ElementType; color: string; onClick: () => void };

// Shared by both the credit-card and regular card faces below — a single "⋮" trigger replacing
// what used to be a row of up to 4 separate icon buttons (View Transactions, Download Statement,
// per-type money actions, Import Statement). Grouped into one dropdown with dividers between
// sections instead of nested submenus, so every action is reachable in exactly one click after
// opening the menu. Its own local component (not inlined twice) since the portal/positioning
// logic is identical in both call sites.
function AccountActionsMenu({ account, moneyActions, onImportStatement, dark = false }: {
  account: WalletAccount;
  moneyActions: CardAction[];
  onImportStatement?: () => void;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);

  // Fixed-position + viewport-clamped like BankNameInput's autocomplete — a plain `absolute`
  // menu can run off-screen for cards near the right edge with no way to reposition itself.
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuWidth = 208;
      const left = Math.min(r.right - menuWidth, window.innerWidth - menuWidth - 8);
      setMenuStyle({ position: "fixed", top: r.bottom + 4, left: Math.max(8, left), width: menuWidth, zIndex: 9999 });
    }
    setOpen(v => !v);
  };

  const downloadStatement = () => {
    setOpen(false);
    // Dynamic import — downloadAccountStatement pulls in jsPDF + jspdf-autotable (lib/pdf/
    // reportPdf.ts), a genuinely heavy dependency that has no reason to sit in every visitor's
    // initial /accounts bundle just because one menu item might eventually need it. Always the
    // all-time statement — the per-year picker this replaced added a second click for a range
    // most people never needed; Reports' own Export tab already covers year-scoped exports.
    void import("../utils/downloadAccountStatement").then(({ downloadAccountStatement }) =>
      downloadAccountStatement(account, "all"));
  };

  const rowClass = "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted/60 transition-colors";

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button ref={btnRef} onClick={toggle} title="Account actions" aria-label="Account actions" aria-haspopup="menu" aria-expanded={open}
        className={cn("w-7 h-7 rounded-lg flex items-center justify-center transition-all",
          dark ? "bg-white/14 hover:bg-white/22 text-white" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted")}>
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {/* Portaled to <body> — the card is itself a click target (opens Edit) and has a
          hover:-translate-y transform, which becomes the containing block for a plain
          `position: fixed` child, clipping/mispositioning it instead of anchoring to the
          viewport. */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" style={menuStyle} className="bg-card border border-border rounded-xl shadow-xl overflow-hidden py-1">
            <Link href={`/expenses?accountId=${account.id}&tab=all`} role="menuitem" onClick={() => setOpen(false)} className={rowClass}>
              <List className="w-4 h-4 text-sky-500" /> View Transactions
            </Link>
            <button role="menuitem" onClick={downloadStatement} className={rowClass}>
              <Download className="w-4 h-4 text-violet-500" /> Download Statement
            </button>
            <div className="my-1 border-t border-border/60" />
            {moneyActions.map(a => {
              const ActionIcon = a.icon;
              return (
                <button key={a.key} role="menuitem" onClick={() => { a.onClick(); setOpen(false); }} className={rowClass}>
                  <ActionIcon className={cn("w-4 h-4", a.color)} /> {a.label}
                </button>
              );
            })}
            {onImportStatement && (
              <>
                <div className="my-1 border-t border-border/60" />
                <button role="menuitem" onClick={() => { onImportStatement(); setOpen(false); }} className={rowClass}>
                  <Upload className="w-4 h-4 text-teal-500" /> Import Statement
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

export const AccountCard = memo(function AccountCard({ account, linkedDebts = [], onAddMoney, onAddExpense, onTransfer, onEdit, onSetPrimary, settingPrimary, onImportStatement }: {
  account:      WalletAccount;
  linkedDebts?: DebtRecord[];
  onAddMoney:   () => void;
  onAddExpense: () => void;
  onTransfer:   () => void;
  onEdit:       () => void;
  onSetPrimary?: () => void;
  settingPrimary?: boolean;
  /** Only passed for account types statement import actually supports (bank/cash) — omitted elsewhere so the button doesn't show for types that can't be an import target. */
  onImportStatement?: () => void;
}) {
  const { fmt } = useAmountFormatter();
  const isCreditCard = account.accountType === "CREDIT_CARD";
  const statusMeta = getLifecycleStatusMeta(account.status);
  const purpose = resolvePurposeLabel(account.purpose, account.purposeLabel);
  const [revealAcctNum, setRevealAcctNum] = useState(false);

  const pct = isCreditCard
    ? (account.creditLimit && account.creditLimit > 0
        ? Math.min(100, (account.currentBalance / account.creditLimit) * 100) : 0)
    : (account.totalMoneyIn > 0
        ? Math.min(100, (account.totalMoneyOut / account.totalMoneyIn) * 100) : 0);

  const daysUntilDue = account.nextDueDate
    ? Math.ceil((new Date(account.nextDueDate).getTime() - Date.now()) / 86400000) : null;
  const dueUrgent = daysUntilDue !== null && daysUntilDue <= 7;

  // Loans populate nextEmiDate, not nextDueDate/nextStatementDate (those are credit-card-only) —
  // same urgency threshold as the credit card badge, just a separate field.
  const daysUntilEmi = account.nextEmiDate
    ? Math.ceil((new Date(account.nextEmiDate).getTime() - Date.now()) / 86400000) : null;
  const emiUrgent = daysUntilEmi !== null && daysUntilEmi <= 7;

  if (isCreditCard) {
    // ── Credit card: premium card design ──────────────────────────────────────
    return (
      <div onClick={onEdit}
        className="relative rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 animate-fade-in-up cursor-pointer">
        {/* Real, separately-focusable control for the same action the card's plain onClick above
            already does — a role="button" here would nest the Account Actions menu control below
            inside another interactive widget (axe's nested-interactive rule), so
            the card itself stays a non-widget div and this sr-only-until-focused button is the
            keyboard/screen-reader path to Edit instead. */}
        <button type="button" onClick={onEdit}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium">
          Edit {account.name}
        </button>
        {/* Background layer — clipped to the rounded corners on its own, so content (like the
            action menu below) isn't also clipped when it needs to overflow the card bounds. */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-600 via-slate-700 to-zinc-800 dark:from-slate-700 dark:via-slate-800 dark:to-zinc-900" />
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -right-2 w-40 h-40 rounded-full bg-white/5" />
        </div>

        {/* Card body */}
        <div className="relative p-5">
          {/* Top row: icon + chip + actions */}
          <div className="flex items-start justify-between mb-4 relative">
            <div className="flex items-center gap-2">
              {getBankMonogram(account.bankName) ? (
                <BankLogo name={account.bankName} fallbackIcon={CreditCard} size="sm" className="w-8 h-8" />
              ) : (
                <div className="bg-white/15 rounded-lg w-8 h-8 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">{account.name}</p>
                {/* Name is auto-generated from the bank ("HDFC Bank Card"), so this line only
                    adds the masked number — repeating the bank name here would just duplicate it. */}
                <p className="text-[11px] text-white/70">
                  {account.accountNumber ? `•••• ${account.accountNumber.slice(-4)}` : "Credit Card"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {statusMeta && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/80">
                  {statusMeta.label}
                </span>
              )}
              {daysUntilDue !== null && (
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full",
                  dueUrgent ? "bg-red-900/60 text-red-200" : "bg-white/15 text-white/80")}>
                  {daysUntilDue < 0 ? "Overdue" : daysUntilDue === 0 ? "Due today" : `Due in ${daysUntilDue}d`}
                </span>
              )}
              <AccountActionsMenu account={account} dark
                moneyActions={[
                  { key: "charge",  label: "Charge",   icon: Receipt,        color: "text-rose-500",   onClick: onAddExpense },
                  { key: "paybill", label: "Pay Bill", icon: ArrowLeftRight, color: "text-indigo-500", onClick: onTransfer },
                ]} />
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
            <p className="text-2xl font-bold text-white tabular-nums">{fmt(account.currentBalance)}</p>
          </div>

          {/* Limit + available */}
          {account.creditLimit && (
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="text-white/60">Limit <span className="text-white/90 font-medium">{fmt(account.creditLimit)}</span></span>
              <span className="text-emerald-200">Available <span className="font-semibold">{fmt(account.availableCredit ?? 0)}</span></span>
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

        {/* Recent transactions removed — see Transactions page */}
        {false && (
          <div>
            {account.recentTransactions.length > 2 && (
              <button onClick={() => {}}
                className="mt-1 w-full text-xs text-muted-foreground/80 hover:text-muted-foreground py-1 transition-colors flex items-center justify-center gap-1">
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

  return (
    <div onClick={onEdit}
      className="relative bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 animate-fade-in-up flex flex-col cursor-pointer overflow-hidden">
      {/* Real, separately-focusable control for the same action the card's plain onClick above
          already does — a role="button" here would nest the Account Actions menu control below
          inside another interactive widget (axe's nested-interactive rule), so
          the card itself stays a non-widget div and this sr-only-until-focused button is the
          keyboard/screen-reader path to Edit instead. */}
      <button type="button" onClick={onEdit}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-20 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-medium">
        Edit {account.name}
      </button>
      {/* Same premium gradient-edge treatment as the form modal headers, tinted to this account
          type's own Apple system color — a lighter touch than the credit card's full "physical
          card" face, but still gives every type its own visible identity rather than just a
          small icon chip. */}
      <div className="h-1" style={{ background: `linear-gradient(to right, ${lighten(meta.hex, 0.35)}, ${meta.hex})` }} />
      <div className="p-5 flex-1 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <BankLogo name={account.bankName} fallbackIcon={meta.icon} fallbackHex={meta.hex} size="md" className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-1 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{account.name}</p>
              {statusMeta && (
                <span className={cn("shrink-0 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5", statusMeta.chipClass)}>
                  {statusMeta.label}
                </span>
              )}
              {purpose && (
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", PURPOSE_CHIP_CLASS)}>
                  {purpose}
                </span>
              )}
              {account.accountType === "BANK_ACCOUNT" && (
                account.primary ? (
                  <span title="Primary account"
                    className="shrink-0 flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5">
                    <Star className="w-2.5 h-2.5" fill="currentColor" /> Primary
                  </span>
                ) : (
                  <button onClick={e => { e.stopPropagation(); onSetPrimary?.(); }} disabled={settingPrimary} title="Set as Primary"
                    className="shrink-0 text-muted-foreground/30 hover:text-amber-500 transition-colors disabled:opacity-40 disabled:cursor-wait">
                    <Star className="w-3 h-3" />
                  </button>
                )
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {account.bankName && account.bankName !== account.name && <p className="text-xs text-muted-foreground">{account.bankName}</p>}
              {account.accountNumber && (
                <div className="flex items-center gap-1">
                  <p className="text-xs text-muted-foreground/80 font-mono">
                    {revealAcctNum ? account.accountNumber : `•••• ${account.accountNumber.slice(-4)}`}
                  </p>
                  <button onClick={e => { e.stopPropagation(); setRevealAcctNum(v => !v); }}
                    className="text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                    {revealAcctNum ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {account.accountType === "LOAN" && daysUntilEmi !== null && (
            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
              emiUrgent ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground")}>
              {daysUntilEmi < 0 ? "EMI overdue" : daysUntilEmi === 0 ? "EMI due today" : `EMI in ${daysUntilEmi}d`}
            </span>
          )}
          <AccountActionsMenu account={account}
            moneyActions={[
              { key: "expense",  label: "Add Expense", icon: Receipt,        color: "text-red-500",     onClick: onAddExpense },
              { key: "income",   label: "Add Income",  icon: Banknote,       color: "text-emerald-500", onClick: onAddMoney },
              { key: "transfer", label: "Transfer",    icon: ArrowLeftRight, color: "text-indigo-500",  onClick: onTransfer },
            ]}
            onImportStatement={onImportStatement} />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
            {account.accountType === "LOAN" ? "Outstanding" : "Balance"}
          </p>
          {account.belowLowBalanceThreshold && (
            <span title={`Below your ${fmt(account.lowBalanceThreshold ?? 0)} alert threshold`}
              className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-500 bg-amber-500/10 rounded-full px-1.5 py-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> Low
            </span>
          )}
        </div>
        <p className={cn("text-2xl font-bold tabular-nums",
          account.currentBalance < 0 ? "text-red-500 dark:text-red-400" : "text-foreground")}>
          {fmt(account.currentBalance)}
        </p>
      </div>

      {account.accountType === "LOAN" && (account.emiAmount || account.autopayAccountName || account.loanEndDate) && (
        <div className="flex flex-col gap-1 mb-3 text-xs">
          {account.emiAmount && (
            <span className="text-muted-foreground">
              Next EMI <span className="text-foreground font-semibold">{fmt(account.emiAmount)}</span>
              {account.nextEmiDate && ` · ${formatDate(account.nextEmiDate)}`}
            </span>
          )}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            {account.autopayAccountName && (
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Autopay via {account.autopayAccountName}
              </span>
            )}
            {account.loanEndDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ends {formatDate(account.loanEndDate)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">In</p>
          </div>
          <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
            {fmt(account.totalMoneyIn)}
          </p>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1 mb-0.5">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <p className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">Out</p>
          </div>
          <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
            {fmt(account.totalMoneyOut)}
          </p>
        </div>
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
                    ↑ {fmt(lentAmt)} lent out
                  </span>
                )}
                {borAmt > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                    ↓ {fmt(borAmt)} borrowed
                  </span>
                )}
              </>
            );
          })()}
        </div>
      )}

      {account.totalMoneyIn > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">Spending</span>
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

      <div className="flex-1" />
      </div>
    </div>
  );
});
