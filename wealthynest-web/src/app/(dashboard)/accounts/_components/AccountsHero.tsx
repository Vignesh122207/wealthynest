"use client";

import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import type {WalletAccount} from "@/features/accounts/types/account.types";

interface AccountsHeroProps {
  accounts: WalletAccount[];
  totalAssetsAcrossAccounts: number;
  bankAccounts: WalletAccount[];
  bankBalance: number;
  cashAccounts: WalletAccount[];
  cashBalance: number;
  creditCards: WalletAccount[];
  creditCardDebt: number;
  loanAccounts: WalletAccount[];
  loanDebt: number;
  fmt: (n: number) => string;
}

// Replaces the old Header-title + AccountStatStrip pairing: just the total balance + a quick
// per-type breakdown as pills, left-aligned — no headline copy. No trend/sparkline on the
// balance figure — there's no historical liquid-balance series to back one (NetWorthHistoryPoint
// is a *net worth* series: assets minus liabilities including investments, a different number
// than "cash + bank" shown here), and a fabricated delta would be worse than none. No "Add
// account" CTA here either — the FAB already covers that action app-wide.
export function AccountsHero({
  accounts, totalAssetsAcrossAccounts, bankAccounts, bankBalance, cashAccounts, cashBalance,
  creditCards, creditCardDebt, loanAccounts, loanDebt, fmt,
}: AccountsHeroProps) {
  const pills = [
    bankAccounts.length > 0 && {
      key: "bank", hex: ACCOUNT_TYPE_META.BANK_ACCOUNT.hex, amount: bankBalance,
      label: `Bank · ${bankAccounts.length}`,
    },
    cashAccounts.length > 0 && {
      key: "cash", hex: ACCOUNT_TYPE_META.CASH_WALLET.hex, amount: cashBalance,
      label: `Cash · ${cashAccounts.length}`,
    },
    creditCards.length > 0 && {
      key: "credit", hex: ACCOUNT_TYPE_META.CREDIT_CARD.hex, amount: creditCardDebt,
      label: creditCardDebt > 0 ? "Credit · dues" : `Credit · ${creditCards.length}`,
    },
    loanAccounts.length > 0 && {
      key: "loan", hex: ACCOUNT_TYPE_META.LOAN.hex, amount: loanDebt,
      label: `Loan · ${loanAccounts.length}`,
    },
  ].filter((p): p is { key: string; hex: string; amount: number; label: string } => Boolean(p));

  // Nothing to total yet — the page's own EmptyState (in AccountsList, below) already carries
  // the "set up your first account" messaging, so an empty numbers-only band here would just be
  // a blank strip with nothing to say.
  if (accounts.length === 0) return null;

  return (
    <section
      aria-label="Accounts overview"
      className="relative -mx-4 md:-mx-5 lg:-mx-6 mb-5 px-4 md:px-5 lg:px-6 pt-6 pb-7 lg:rounded-b-[28px] overflow-hidden bg-background"
    >
      {/* Soft brand glow — sits behind the numbers, which are on the left now, so the glow moved
          with them instead of lighting up empty space on the right. Plain background otherwise,
          no section-wide tint. */}
      <div aria-hidden className="absolute -top-20 -left-12 w-64 h-64 rounded-full blur-3xl opacity-[0.14]
        bg-gradient-to-br from-indigo-500 to-violet-600 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        <div className="w-full lg:w-[420px]">
          {/* Caption above, figure below — the standard hero-KPI stack (label first, value
              dominant), not a label-left/value-right row. */}
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1">Total balance</p>
          <p className="text-4xl lg:text-5xl font-bold tabular-nums text-foreground leading-none">
            {fmt(totalAssetsAcrossAccounts)}
          </p>

          {pills.length > 0 && (
            /* Per-type breakdown as self-contained stat chips — value first (bold, what you
               scan for), type label second (muted, secondary context) — the opposite order
               from the row list below, which is a list, not a chip. */
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5" style={{ scrollbarWidth: "none" }}>
              {pills.map(p => (
                <div key={p.key} className="shrink-0 flex items-center gap-2 bg-card border border-border rounded-2xl px-3.5 py-2.5 shadow-sm">
                  <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: p.hex }} aria-hidden />
                  <div className="leading-tight">
                    <p className="text-[13px] font-bold tabular-nums text-foreground">{fmt(p.amount)}</p>
                    <p className="text-[10px] text-muted-foreground/80">{p.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
