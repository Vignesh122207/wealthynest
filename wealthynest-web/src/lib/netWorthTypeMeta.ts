import {
    BadgePercent,
    Building2,
    Car,
    Coins,
    CreditCard,
    Gem,
    GraduationCap,
    HandCoins,
    Home,
    Landmark,
    Layers,
    type LucideIcon,
    Package,
    PiggyBank,
    TrendingUp,
    Wallet,
} from "lucide-react";
import {ASSET_TYPES, LIABILITY_TYPES} from "./constants";

export interface NetWorthTypeMetaEntry {
  icon: LucideIcon;
  hex:  string;
}

// Single source of truth for asset/liability type icon+color — the Net Worth page
// previously rendered a raw emoji in a plain colored square (ASSET_ICONS/LIABILITY_ICONS
// in constants.ts), the one place in the app still not on the PremiumIcon glossy-badge
// system used everywhere else. Hex values match those existing maps so nothing shifts.
export const ASSET_TYPE_META: Record<string, NetWorthTypeMetaEntry> = {
  REAL_ESTATE:     { icon: Home,       hex: "#6366f1" },
  VEHICLE:         { icon: Car,        hex: "#06b6d4" },
  GOLD_JEWELRY:    { icon: Gem,        hex: "#f59e0b" },
  EPF_PPF:         { icon: PiggyBank,  hex: "#22c55e" },
  BUSINESS_EQUITY: { icon: Building2,  hex: "#8b5cf6" },
  RECEIVABLES:     { icon: HandCoins,  hex: "#3b82f6" },
  OTHER:           { icon: Package,    hex: "#64748b" },
  // Legacy types — no longer selectable in the form, but old records may still carry them.
  BANK_ACCOUNT: { icon: Landmark,   hex: "#5856D6" },
  CASH:         { icon: Wallet,     hex: "#34C759" },
  STOCK:        { icon: TrendingUp, hex: "#6366f1" },
  MUTUAL_FUND:  { icon: Layers,     hex: "#22c55e" },
  BOND:         { icon: BadgePercent, hex: "#8b5cf6" },
  GOLD:         { icon: Coins,      hex: "#f59e0b" },
};

export const LIABILITY_TYPE_META: Record<string, NetWorthTypeMetaEntry> = {
  HOME_LOAN:      { icon: Home,           hex: "#ef4444" },
  CAR_LOAN:       { icon: Car,            hex: "#f97316" },
  PERSONAL_LOAN:  { icon: HandCoins,      hex: "#ec4899" },
  CREDIT_CARD:    { icon: CreditCard,     hex: "#dc2626" },
  EDUCATION_LOAN: { icon: GraduationCap,  hex: "#a855f7" },
  GOLD_LOAN:      { icon: Coins,          hex: "#eab308" },
  BUSINESS_LOAN:  { icon: Building2,      hex: "#0ea5e9" },
  OTHER:          { icon: Package,        hex: "#64748b" },
};

const DEFAULT_META: NetWorthTypeMetaEntry = { icon: Package, hex: "#64748b" };

export function getAssetTypeMeta(type: string): NetWorthTypeMetaEntry {
  return ASSET_TYPE_META[type] ?? DEFAULT_META;
}

export function getLiabilityTypeMeta(type: string): NetWorthTypeMetaEntry {
  return LIABILITY_TYPE_META[type] ?? DEFAULT_META;
}

// Combines each feature's own { value, label } list (ASSET_TYPES/LIABILITY_TYPES) with this
// file's icon+color map, for IconOptionPicker call sites — a single source of truth instead of
// each form separately zipping the two lists together (and risking them drifting out of order).
export const ASSET_TYPE_ICON_OPTIONS = ASSET_TYPES.map(t => ({ ...t, ...getAssetTypeMeta(t.value) }));
export const LIABILITY_TYPE_ICON_OPTIONS = LIABILITY_TYPES.map(t => ({ ...t, ...getLiabilityTypeMeta(t.value) }));

/** Resolves a raw type value (e.g. "HOME_LOAN") to its display label via an { value, label } option list. */
export function typeLabel(types: { value: string; label: string }[], val: string): string {
  return types.find(t => t.value === val)?.label ?? val;
}

// A home/car/gold loan is secured against an asset the Net Worth page already counts (real
// estate, vehicle, gold) — normal, healthy leverage, unlike a credit card or personal loan.
const SECURED_LIABILITY_TYPES = new Set(["HOME_LOAN", "CAR_LOAN", "GOLD_LOAN"]);

/** Debt-to-asset ratio computed only from unsecured/revolving liabilities (credit cards,
 * personal/education/business loans, etc.) — used to color/caption the Net Worth page's ratio
 * bar so a serviced mortgage doesn't read as a "prioritise debt reduction" warning the way an
 * actual unsecured balance should. */
export function unsecuredDebtRatio(
  liabilityBreakdown: { liabilityType: string; totalOutstanding: number }[],
  totalAssets: number
): number {
  if (totalAssets <= 0) return 0;
  const unsecured = liabilityBreakdown
    .filter((b) => !SECURED_LIABILITY_TYPES.has(b.liabilityType))
    .reduce((sum, b) => sum + b.totalOutstanding, 0);
  return Math.min(100, (unsecured / totalAssets) * 100);
}
