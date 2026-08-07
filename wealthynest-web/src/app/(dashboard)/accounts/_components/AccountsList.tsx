"use client";

import {Plus, Wallet} from "lucide-react";
import {EmptyState} from "@/components/shared/EmptyState";
import {QueryErrorState} from "@/components/shared/QueryErrorState";
import {PremiumIcon} from "@/components/icons/PremiumIcon";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import type {AccountType, WalletAccount} from "@/features/accounts/types/account.types";
import type {SectionFilter} from "./AccountFilterTabs";

interface AccountsListProps {
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  accounts: WalletAccount[];
  sectionFilter: SectionFilter;
  allAccountsOrdered: WalletAccount[];
  bankAccounts: WalletAccount[];
  cashAccounts: WalletAccount[];
  creditCards: WalletAccount[];
  loanAccounts: WalletAccount[];
  renderAccountCard: (a: WalletAccount) => React.ReactNode;
  onCreate: (type: AccountType) => void;
}

// A single bordered "ledger" — one row per account, divided by a hairline rule — instead of a
// card grid. Wraps whatever renderAccountCard hands back (AccountCard or LoanCard, both now row-
// shaped) without needing to know which.
function Ledger({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl divide-y divide-border/60 shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 bg-muted rounded animate-pulse" />
        <div className="h-2.5 w-20 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
    </div>
  );
}

// The Accounts page's main content — loading skeleton, empty state, the unified "All" ledger, and
// the four per-type sections. Pulled out of the page purely to cut its size; every value here is
// already computed/held by the page. Purpose (Emergency Fund, etc.) is a tag shown inline on a
// Bank Account's own row now, not a separate type or section — same for what used to be a
// distinct "Investment Account" type (broker cash float is just a purpose-tagged bank account).
export function AccountsList({
  isLoading, isError, onRetry, accounts, sectionFilter, allAccountsOrdered, bankAccounts, cashAccounts,
  creditCards, loanAccounts, renderAccountCard, onCreate,
}: AccountsListProps) {
  if (isLoading) {
    return (
      <Ledger>
        {[1, 2, 3].map(i => <RowSkeleton key={i} />)}
      </Ledger>
    );
  }

  if (isError) {
    return <QueryErrorState onRetry={() => onRetry?.()} description="Couldn't load your accounts. Check your connection and try again." />;
  }

  if (accounts.length === 0) {
    return (
      <EmptyState icon={Wallet} title="No accounts yet"
        description="Set up your Bank Account, Cash Wallet, Credit Card, or Loan."
        action={
          <div className="flex flex-wrap gap-2 justify-center">
            {(["BANK_ACCOUNT", "CASH_WALLET", "CREDIT_CARD", "LOAN"] as AccountType[]).map(t => {
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
    // Unified view: every account, one continuous ledger, ordered Bank → Cash Wallet → Credit
    // Cards → Loans.
    return (
      <Ledger>
        {allAccountsOrdered.map(a => renderAccountCard(a))}
      </Ledger>
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
            <Ledger>{bankAccounts.map(a => renderAccountCard(a))}</Ledger>
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
              <h2 className="text-sm font-semibold text-foreground">Cash Wallet</h2>
            </div>
            {cashAccounts.length === 0 && (
              <button onClick={() => onCreate("CASH_WALLET")} className="text-xs text-emerald-500 dark:text-emerald-400 hover:underline flex items-center gap-1 transition-colors">
                <Plus className="w-3 h-3" /> Cash Wallet
              </button>
            )}
          </div>
          {cashAccounts.length > 0
            ? <Ledger>{cashAccounts.map(a => renderAccountCard(a))}</Ledger>
            : <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
                <p className="text-sm text-muted-foreground">No cash wallet</p>
                <button onClick={() => onCreate("CASH_WALLET")} className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 hover:underline transition-colors">+ Set up</button>
              </div>
          }
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
            <Ledger>{creditCards.map(a => renderAccountCard(a))}</Ledger>
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
            <Ledger>{loanAccounts.map(a => renderAccountCard(a))}</Ledger>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 text-center">
              <p className="text-sm text-muted-foreground">No loans tracked</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Track EMIs and see loans reflected in your net worth automatically.</p>
              <button onClick={() => onCreate("LOAN")} className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:underline transition-colors">+ Add Loan</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
