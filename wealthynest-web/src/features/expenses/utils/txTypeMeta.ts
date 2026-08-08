import type {TxType} from "../types/filters.types";

// Shared per-type identity — every place a transaction type gets its own color needs to agree on
// the same rose/emerald/indigo mapping: Toolbar's desktop Type button, FilterPanel's mobile Type
// section, and (until it existed) the old TypeTabs tab bar.
export const TX_TYPE_COLOR: Record<TxType, string> = {
  all:       "#475569",
  expenses:  "#e11d48",
  income:    "#059669",
  transfers: "#4f46e5",
};

export const TX_TYPE_LABEL: Record<TxType, string> = {
  all:       "All",
  expenses:  "Expenses",
  income:    "Income",
  transfers: "Transfers",
};

export const TX_TYPE_OPTIONS: TxType[] = ["all", "expenses", "income", "transfers"];
