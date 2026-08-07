"use client";

import {CreditCard, HandCoins, Landmark, Wallet} from "lucide-react";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {cn} from "@/lib/utils";
import type {WalletAccount} from "@/features/accounts/types/account.types";

interface AccountStatStripProps {
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

// One uniform card per type the user actually has (same size/shape as the type breakdowns
// below), so someone with just a bank account and a credit card sees 2 cards, not 4 padded out
// with empty types they haven't set up.
export function AccountStatStrip({
  accounts, totalAssetsAcrossAccounts, bankAccounts, bankBalance, cashAccounts, cashBalance,
  creditCards, creditCardDebt, loanAccounts, loanDebt, fmt,
}: AccountStatStripProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 animate-fade-in-up">
      <div className="bg-primary/8 rounded-md border border-primary/10 dark:border-primary/20 shadow-soft dark:shadow-none p-4">
        <PremiumIcon icon={Wallet} tone="blue" size="xs" className="mb-2" />
        <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Total Balance</p>
        <p className="text-base font-extrabold tabular-nums text-foreground">{fmt(totalAssetsAcrossAccounts)}</p>
        <p className="text-[10px] text-muted-foreground/80">Cash &amp; bank, purpose tags included</p>
      </div>

      {bankAccounts.length > 0 && (
        <div className="bg-card rounded-md border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4">
          <PremiumIcon icon={Landmark} hex={ACCOUNT_TYPE_META.BANK_ACCOUNT.hex} size="xs" className="mb-2" />
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Bank</p>
          <p className="text-base font-extrabold tabular-nums text-foreground">{fmt(bankBalance)}</p>
          <p className="text-[10px] text-muted-foreground/80">{bankAccounts.length} account{bankAccounts.length === 1 ? "" : "s"}</p>
        </div>
      )}

      {cashAccounts.length > 0 && (
        <div className="bg-card rounded-md border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4">
          <PremiumIcon icon={Wallet} hex={ACCOUNT_TYPE_META.CASH_WALLET.hex} size="xs" className="mb-2" />
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Cash Wallet</p>
          <p className="text-base font-extrabold tabular-nums text-foreground">{fmt(cashBalance)}</p>
          <p className="text-[10px] text-muted-foreground/80">{cashAccounts.length} account{cashAccounts.length === 1 ? "" : "s"}</p>
        </div>
      )}

      {/* Assets end here, liabilities (Credit Cards, Loans) follow — kept grouped so the strip
          reads assets-then-liabilities left to right. */}
      {creditCards.length > 0 && (
        <div className="bg-card rounded-md border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4">
          <PremiumIcon icon={CreditCard} hex={ACCOUNT_TYPE_META.CREDIT_CARD.hex} size="xs" className="mb-2" />
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Credit Cards</p>
          <p className="text-base font-extrabold tabular-nums text-foreground">{fmt(creditCardDebt)}</p>
          <p className={cn("text-[10px]", creditCardDebt > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/80")}>
            {creditCards.length} card{creditCards.length === 1 ? "" : "s"}{creditCardDebt > 0 ? " · dues" : ""}
          </p>
        </div>
      )}

      {loanAccounts.length > 0 && (
        <div className="bg-card rounded-md border border-slate-100/80 dark:border-border/50 shadow-soft dark:shadow-none p-4">
          <PremiumIcon icon={HandCoins} hex={ACCOUNT_TYPE_META.LOAN.hex} size="xs" className="mb-2" />
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Loans</p>
          <p className="text-base font-extrabold tabular-nums text-foreground">{fmt(loanDebt)}</p>
          <p className={cn("text-[10px]", loanDebt > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground/80")}>
            {loanAccounts.length} active
          </p>
        </div>
      )}
    </div>
  );
}
