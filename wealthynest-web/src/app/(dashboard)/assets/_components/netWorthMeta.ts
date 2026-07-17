import { TrendingUp, Layers, Coins, Building2, Percent, BarChart3, type LucideIcon } from "lucide-react";

// ─── Investment type meta (for net worth breakdown) ──────────────────────────

export const INV_TYPE_META: Record<string, { label: string; color: string; icon: LucideIcon; tab: string }> = {
  STOCK:       { label: "Stocks",         color: "#6366f1", icon: TrendingUp,  tab: "stocks"   },
  MUTUAL_FUND: { label: "Mutual Funds",   color: "#22c55e", icon: Layers,      tab: "mf"       },
  GOLD:        { label: "Gold",           color: "#f59e0b", icon: Coins,       tab: "gold"     },
  GOLD_ETF:    { label: "Gold ETF",       color: "#fbbf24", icon: Coins,       tab: "gold"     },
  FD:          { label: "Fixed Deposits", color: "#0ea5e9", icon: Building2,   tab: "fd"       },
  BOND:        { label: "Bonds",          color: "#8b5cf6", icon: Percent,     tab: "bonds"    },
  PPF:         { label: "PPF",            color: "#ec4899", icon: TrendingUp,  tab: "overview" },
  NPS:         { label: "NPS",            color: "#14b8a6", icon: TrendingUp,  tab: "overview" },
  REIT:        { label: "REIT",           color: "#f97316", icon: Building2,   tab: "overview" },
  OTHER:       { label: "Other Inv.",     color: "#64748b", icon: BarChart3,   tab: "overview" },
};
// Investment-origin types — explicitly listed so "OTHER" manual assets are NOT caught
export const INVESTMENT_TYPE_KEYS = new Set([
  "STOCK", "MUTUAL_FUND", "GOLD", "GOLD_ETF", "FD", "BOND", "PPF", "NPS", "REIT",
]);
