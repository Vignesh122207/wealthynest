import {create} from "zustand";
import {persist} from "zustand/middleware";

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)",       symbol: "₹" },
  { code: "USD", label: "US Dollar ($)",          symbol: "$" },
  { code: "EUR", label: "Euro (€)",               symbol: "€" },
  { code: "GBP", label: "British Pound (£)",      symbol: "£" },
  // The two largest NRI remittance corridors into India — added alongside the majors above so
  // NRI households don't stop at "close enough" with USD/EUR/GBP. Neither has a glyph
  // formatCurrency's Intl.NumberFormat actually renders (it prints "AED 1,234"/"SGD 1,234", not
  // a symbol) — symbol is the ISO code for both, so this list matches what a user actually sees.
  { code: "AED", label: "UAE Dirham (AED)",       symbol: "AED" },
  { code: "SGD", label: "Singapore Dollar (S$)",  symbol: "SGD" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

interface PrefsState {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      currency:    "INR",
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "wn-preferences" }
  )
);
