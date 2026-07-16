import {
  TrendingUp, Layers, Coins, Building2, BadgePercent, PiggyBank, Landmark, Home, Package,
  type LucideIcon,
} from "lucide-react";
import type { InvestmentType } from "@/features/investments/types/investment.types";

export interface InvestmentTypeMetaEntry {
  label: string;
  icon:  LucideIcon;
  hex:   string;
}

// Single source of truth for investment-type icon/color. Previously each
// investment row showed a plain colored initials square with no icon at all;
// hex values are kept identical to the investments page's old TAB_COLORS so
// the allocation chart's colors don't shift.
export const INVESTMENT_TYPE_META: Record<InvestmentType, InvestmentTypeMetaEntry> = {
  STOCK:       { label: "Stock",         icon: TrendingUp,   hex: "#6366f1" },
  MUTUAL_FUND: { label: "Mutual Fund",   icon: Layers,       hex: "#22c55e" },
  BOND:        { label: "Bond",          icon: BadgePercent, hex: "#8b5cf6" },
  FD:          { label: "Fixed Deposit", icon: Building2,    hex: "#0ea5e9" },
  GOLD:        { label: "Gold",          icon: Coins,        hex: "#f59e0b" },
  GOLD_ETF:    { label: "Gold ETF",      icon: Coins,        hex: "#fbbf24" },
  PPF:         { label: "PPF",           icon: PiggyBank,    hex: "#ec4899" },
  NPS:         { label: "NPS",           icon: Landmark,     hex: "#14b8a6" },
  REIT:        { label: "REIT",          icon: Home,         hex: "#f43f5e" },
  OTHER:       { label: "Other",         icon: Package,      hex: "#64748b" },
};
