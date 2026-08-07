export interface CurrencyRates {
  base:      string;
  rates:     Record<string, number>;
  fetchedAt: string;
  stale:     boolean;
}

/** Currencies the Transactions page's toggle can convert into — a subset of the app-wide
 * CURRENCIES list (preferences.store.ts), limited to what the backend actually fetches live
 * rates for. Every amount in this app is entered/stored in INR. */
export const CONVERTIBLE_CURRENCIES = ["INR", "USD", "EUR"] as const;
export type ConvertibleCurrency = typeof CONVERTIBLE_CURRENCIES[number];
