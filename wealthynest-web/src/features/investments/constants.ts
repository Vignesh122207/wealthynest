import {BadgePercent, BarChart3, Building2, Coins, Layers, TrendingUp} from "lucide-react";
import type {InvestmentType} from "./types/investment.types";

export type PickerAccountList = { id: string; name: string; bankName?: string; currentBalance: number }[];

export const TABS = [
  { id: "overview",  label: "Overview",      icon: BarChart3 },
  { id: "stocks",    label: "Stocks",         icon: TrendingUp },
  { id: "mf",        label: "Mutual Funds",   icon: Layers },
  { id: "gold",      label: "Gold",           icon: Coins },
  { id: "fd",        label: "Fixed Deposits", icon: Building2 },
  { id: "bonds",     label: "Bonds",          icon: BadgePercent },
] as const;

export type TabId = typeof TABS[number]["id"];

export const TAB_TO_INVESTMENT_TYPE: Partial<Record<TabId, InvestmentType>> = {
  stocks: "STOCK", mf: "MUTUAL_FUND", gold: "GOLD", fd: "FD", bonds: "BOND",
};

export const COUPON_FREQ = [
  { value: "MONTHLY",     label: "Monthly" },
  { value: "QUARTERLY",   label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "ANNUALLY",    label: "Annually" },
];

export const COMPOUND_FREQ = [
  { value: "SIMPLE",      label: "Simple Interest" },
  { value: "QUARTERLY",   label: "Quarterly Compounding" },
  { value: "MONTHLY",     label: "Monthly Compounding" },
  { value: "HALF_YEARLY", label: "Half-Yearly Compounding" },
  { value: "ANNUALLY",    label: "Annual Compounding" },
];

export const KARAT_OPTIONS = [
  { value: 22, label: "22K (standard jewellery)" },
  { value: 24, label: "24K (pure gold / coins)" },
  { value: 18, label: "18K (hallmark jewellery)" },
] as const;

export const INV_TYPE_LABELS: Record<string, string> = {
  STOCK: "Stocks", MUTUAL_FUND: "Mutual Funds", GOLD: "Gold", GOLD_ETF: "Gold ETF",
  FD: "Fixed Deposits", BOND: "Bonds", PPF: "PPF", NPS: "NPS", OTHER: "Other",
};

export type SortKey = "value_desc" | "gain_desc" | "gain_pct_desc" | "name_asc" | "date_desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "value_desc",    label: "Value ↓" },
  { value: "gain_desc",     label: "Gain ↓" },
  { value: "gain_pct_desc", label: "Return % ↓" },
  { value: "name_asc",      label: "Name A–Z" },
  { value: "date_desc",     label: "Newest first" },
];
