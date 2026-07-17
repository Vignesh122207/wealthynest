"use client";

import { Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { PremiumIcon } from "@/components/icons/PremiumIcon";
import { AddMoreCard } from "@/features/accounts/components/AddMoreCard";
import { ACCOUNT_TYPE_META } from "@/lib/accountTypeMeta";
import type { AccountType, WalletAccount } from "@/features/accounts/types/account.types";
import type { SectionFilter } from "./AccountFilterTabs";

interface AccountsGridProps {
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  accounts: WalletAccount[];
  sectionFilter: SectionFilter;
  allAccountsOrdered: WalletAccount[];
  bankAccounts: WalletAccount[];
  cashAccounts: WalletAccount[];
  emergencyAccounts: WalletAccount[];
  investAccounts: WalletAccount[];
  creditCards: WalletAccount[];
  loanAccounts: WalletAccount[];
  renderAccountCard: (a: WalletAccount) => React.ReactNode;
  onCreate: (type: AccountType) => void;
}

// The Accounts page's main content — loading skeleton, empty state, the unified "All" grid, and
// the six per-type sections. Pulled out of the page purely to cut its size; every value here is
// already computed/held by the page.
export function AccountsGrid({
  isLoading, isError, onRetry, accounts, sectionFilter, allAccountsOrdered, bankAccounts, cashAccounts,
  emergencyAccounts, investAccounts, creditCards, loanAccounts, renderAccountCard, onCreate,
}: AccountsGridProps) {
  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  if (isError) {
    return <QueryErrorState onRetry={() => onRetry?.()} description="Couldn't load your accounts. Check your connection and try again." />;
  }

  if (accounts.length === 0) {
    return (
      <EmptyState icon={Wallet} title="No accounts yet"
        description="Set up your Bank Account, Cash Wallet, Credit Card, Loan, or Investment Account."
        action={
          <div className="flex flex-wrap gap-2 justify-center">
            {(["BANK_ACCOUNT", "CASH_WALLET", "EMERGENCY_FUND", "CREDIT_CARD", "LOAN", "INVESTMENT"] as AccountType[]).map(t => {
              const m = ACCOUNT_TYPE_META[t];
              return (
                <button key={t} onClick={() => onCreate(t)}
                  className="flex items-center gap-2 h-9 pl-2 pr-4 rounded-xl text-sm font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all">
                  <PremiumIcon icon={m.icon} hex={m.hex} size="xs" /> {m.label}
                </button>
              );
            })}
          </div>
        } />
    );
  }

  if (sectionFilter === "all") {
    // Unified view: every account, one continuous grid, ordered Bank → Cash & Emergency →
    // Investments → Credit Cards → Loans — a lone Bank account and a lone Cash Wallet land in
    // the same row instead of each sitting alone in its own full-width section.
    return (
      <div className="grid gap-4 lg:grid-cols-2 animate-fade-in-up">
        {allAccountsOrdered.map(a => renderAccountCard(a))}
        {allAccountsOrdered.length % 2 === 1 && (
          <AddMoreCard label="Account" type="BANK_ACCOUNT" onClick={() => onCreate("BANK_ACCOUNT")} />
        )}
      </div>
    );
  }

  return (
    <>
      {sectionFilter === "bank" && (
        <section className="animate-fade-in-up delay-150">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PremiumIcon icon={ACCOUNT_TYPE_META.BANK_ACCOUNT.icon} hex={ACCOUNT_TYPE_META.BANK_ACCOUNT.hex} size="xs" />
              <h2 className="text-sm font-semibold text-foreground">Bank Accounts</h2>
            </div>
            <button onClick={() => onCreate("BANK_ACCOUNT")}
              className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Add Bank
            </button>
          </div>
          {bankAccounts.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {bankAccounts.map(a => renderAccountCard(a))}
              {bankAccounts.length % 2 === 1 && (
                <AddMoreCard label="Bank Account" type="BANK_ACCOUNT" onClick={() => onCreate("BANK_ACCOUNT")} />
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No bank accounts added</p>
              <button onClick={() => onCreate("BANK_ACCOUNT")} className="mt-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline transition-colors">+ Add Bank Account</button>
            </div>
          )}
        </section>
      )}

      {sectionFilter === "cash" && (
        <section className="animate-fade-in-up delay-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PremiumIcon icon={ACCOUNT_TYPE_META.CASH_WALLET.icon} hex={ACCOUNT_TYPE_META.CASH_WALLET.hex} size="xs" />
              <h2 className="text-sm font-semibold text-foreground">Cash &amp; Emergency</h2>
            </div>
            <div className="flex items-center gap-3">
              {cashAccounts.length === 0 && (
                <button onClick={() => onCreate("CASH_WALLET")} className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Cash Wallet
                </button>
              )}
              {emergencyAccounts.length === 0 && (
                <button onClick={() => onCreate("EMERGENCY_FUND")} className="text-xs text-amber-500 dark:text-amber-400 hover:underline flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Emergency Fund
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {cashAccounts.length > 0
              ? cashAccounts.map(a => renderAccountCard(a))
              : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No cash wallet</p>
                  <button onClick={() => onCreate("CASH_WALLET")} className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 hover:underline transition-colors">+ Set up</button>
                </div>
            }
            {emergencyAccounts.length > 0
              ? emergencyAccounts.map(a => renderAccountCard(a))
              : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                  <p className="text-sm text-muted-foreground">No emergency fund</p>
                  <button onClick={() => onCreate("EMERGENCY_FUND")} className="mt-2 text-xs text-amber-500 dark:text-amber-400 hover:underline transition-colors">+ Set up</button>
                </div>
            }
          </div>
        </section>
      )}

      {sectionFilter === "invest" && (
        <section className="animate-fade-in-up delay-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PremiumIcon icon={ACCOUNT_TYPE_META.INVESTMENT.icon} hex={ACCOUNT_TYPE_META.INVESTMENT.hex} size="xs" />
              <h2 className="text-sm font-semibold text-foreground">Investment Accounts</h2>
            </div>
            <button onClick={() => onCreate("INVESTMENT")}
              className="text-xs text-sky-500 dark:text-sky-400 hover:underline flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Add Account
            </button>
          </div>
          {investAccounts.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {investAccounts.map(a => renderAccountCard(a))}
              {investAccounts.length % 2 === 1 && (
                <AddMoreCard label="Investment Account" type="INVESTMENT" onClick={() => onCreate("INVESTMENT")} />
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No investment accounts</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Track cash parked with your broker (Zerodha, Groww…) and buy investments from it.</p>
              <button onClick={() => onCreate("INVESTMENT")} className="mt-2 text-xs text-sky-500 dark:text-sky-400 hover:underline transition-colors">+ Add Investment Account</button>
            </div>
          )}
        </section>
      )}

      {sectionFilter === "cc" && (
        <section className="animate-fade-in-up delay-375">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PremiumIcon icon={ACCOUNT_TYPE_META.CREDIT_CARD.icon} hex={ACCOUNT_TYPE_META.CREDIT_CARD.hex} size="xs" />
              <h2 className="text-sm font-semibold text-foreground">Credit Cards</h2>
            </div>
            <button onClick={() => onCreate("CREDIT_CARD")}
              className="text-xs text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Add Card
            </button>
          </div>
          {creditCards.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {creditCards.map(a => renderAccountCard(a))}
              {creditCards.length % 2 === 1 && (
                <AddMoreCard label="Credit Card" type="CREDIT_CARD" onClick={() => onCreate("CREDIT_CARD")} />
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No credit cards added</p>
              <button onClick={() => onCreate("CREDIT_CARD")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Credit Card</button>
            </div>
          )}
        </section>
      )}

      {sectionFilter === "loan" && (
        <section className="animate-fade-in-up delay-450">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PremiumIcon icon={ACCOUNT_TYPE_META.LOAN.icon} hex={ACCOUNT_TYPE_META.LOAN.hex} size="xs" />
              <h2 className="text-sm font-semibold text-foreground">Loans</h2>
            </div>
            <button onClick={() => onCreate("LOAN")}
              className="text-xs text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 transition-colors">
              <Plus className="w-3 h-3" /> Add Loan
            </button>
          </div>
          {loanAccounts.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {loanAccounts.map(a => renderAccountCard(a))}
              {loanAccounts.length % 2 === 1 && (
                <AddMoreCard label="Loan" type="LOAN" onClick={() => onCreate("LOAN")} />
              )}
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No loans tracked</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Track EMIs and see loans reflected in your net worth automatically.</p>
              <button onClick={() => onCreate("LOAN")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Loan</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
