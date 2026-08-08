import {create} from "zustand";
import {persist} from "zustand/middleware";

export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)",       symbol: "₹" },
  { code: "USD", label: "US Dollar ($)",          symbol: "$" },
  { code: "EUR", label: "Euro (€)",               symbol: "€" },
  { code: "GBP", label: "British Pound (£)",      symbol: "£" },
  // The two largest NRI remittance corridors into India — added alongside the majors above so
  // NRI households don't stop at "close enough" with USD/EUR/GBP. AED's `symbol` here is a
  // text-context placeholder only (CSV headers, masked balances, amount-input prefixes) — its
  // real glyph is the Central Bank's 2025 dirham sign, rendered as an SVG (DirhamSign) in the
  // Appearance currency picker, the one place it's purely decorative rather than concatenated
  // into a string. "S$" is SGD's genuine everyday informal notation, kept as-is.
  { code: "AED", label: "UAE Dirham (AED)",       symbol: "AED" },
  { code: "SGD", label: "Singapore Dollar (S$)",  symbol: "S$" },
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
