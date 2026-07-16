"use client";

import { usePrivacyStore } from "@/store/privacy.store";
import { usePrefsStore } from "@/store/preferences.store";
import { formatCurrency, formatCurrencyCompact, formatCurrencyExact, getCurrencySymbol } from "@/lib/utils";

// Fixed-shape placeholders (never derived from the real value, so magnitude
// stays hidden). Uses a small interpunct (·) rather than a bullet (•) for a
// subtler mask, with no comma grouping.
const maskFor      = (symbol: string) => `${symbol} ······`;
const maskCompactFor = (symbol: string) => `${symbol} ···`;

// Wraps formatCurrency/formatCurrencyCompact so any component can mask real
// amounts when the user has privacy mode on, without every call site needing
// its own conditional. Subscribes to both stores (not a plain .getState() read)
// so components re-render correctly the instant either toggle changes.
export function useAmountFormatter() {
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const currency    = usePrefsStore((s) => s.currency);
  const symbol      = getCurrencySymbol(currency);
  return {
    hideAmounts,
    fmt:      (amount: number, currency?: string) => (hideAmounts ? maskFor(currency ? getCurrencySymbol(currency) : symbol) : formatCurrency(amount, currency)),
    fmtC:     (amount: number, currency?: string) => (hideAmounts ? maskCompactFor(currency ? getCurrencySymbol(currency) : symbol) : formatCurrencyCompact(amount, currency)),
    fmtExact: (amount: number, currency?: string) => (hideAmounts ? maskFor(currency ? getCurrencySymbol(currency) : symbol) : formatCurrencyExact(amount, currency)),
  };
}
