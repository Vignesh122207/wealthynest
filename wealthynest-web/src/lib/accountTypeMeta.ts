import {CreditCard, HandCoins, Landmark, type LucideIcon, Wallet,} from "lucide-react";
import type {AccountType} from "@/features/accounts/types/account.types";

export interface AccountTypeMetaEntry {
  label: string;
  /** Short lowercase description for compact widgets (e.g. dashboard chips). */
  sub:   string;
  icon:  LucideIcon;
  /** Tailwind text-color classes (light/dark) for icon chips and small UI. */
  color: string;
  /** Tailwind bg-color class for icon chip backgrounds. */
  bg:    string;
  /** Raw hex for contexts needing an inline style value. */
  hex:   string;
}

/**
 * Single source of truth for how each account type is labelled, coloured, and
 * iconified across the app. Previously duplicated independently in the Accounts
 * page and the dashboard's Accounts Overview widget, which had drifted out of
 * sync (Bank Account and Loan had swapped icons; Cash Wallet and Emergency Fund
 * had swapped colors, between the two places).
 */
// hex values are Apple system colors, matched to PremiumIcon's tone palette
// (green/indigo/orange/pink/red/cyan) — CREDIT_CARD's hex used to be a plain
// gray (#475569) that didn't match its own "rose" text/bg classes at all.
export const ACCOUNT_TYPE_META: Record<AccountType, AccountTypeMetaEntry> = {
  CASH_WALLET:    { label: "Cash Wallet",    sub: "Cash wallet",         icon: Wallet,      color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10", hex: "#34C759" },
  BANK_ACCOUNT:   { label: "Bank Account",   sub: "Bank account",        icon: Landmark,    color: "text-indigo-500 dark:text-indigo-400",   bg: "bg-indigo-500/10",  hex: "#5856D6" },
  CREDIT_CARD:    { label: "Credit Card",    sub: "Credit card",         icon: CreditCard,  color: "text-pink-500 dark:text-pink-400",       bg: "bg-pink-500/10",    hex: "#FF375F" },
  LOAN:           { label: "Loan",           sub: "Loan",                icon: HandCoins,   color: "text-red-500 dark:text-red-400",         bg: "bg-red-500/10",     hex: "#FF3B30" },
};
