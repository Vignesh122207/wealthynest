import {
  Baby, Car, GraduationCap, Hammer, Heart, Home, PiggyBank, Plane,
  Receipt, ShieldCheck, ShoppingBag, Sparkles, Stethoscope, TrendingDown, TrendingUp, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { IconTone } from "@/components/icons/PremiumIcon";
import { PURPOSE_LABELS } from "@/features/accounts/schemas/account.schema";

// Unlike account types (each with its own icon/color), every purpose intentionally shares one
// visual treatment on account cards — a purpose is a tag, not a structural distinction there.
// The Purpose *picker* is a different context (choosing among 16 options up front, same job the
// bank/broker picker's per-row logos do) — each purpose gets its own icon/tone there so the list
// is scannable, without changing how a chosen purpose reads once it's just a tag on a card.
export const PURPOSE_CHIP_CLASS =
  "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20";

export const PURPOSE_ICON_META: Record<string, { icon: LucideIcon; tone: IconTone }> = {
  EMERGENCY_FUND:   { icon: ShieldCheck,   tone: "orange" },
  RETIREMENT:       { icon: PiggyBank,     tone: "purple" },
  EDUCATION:        { icon: GraduationCap, tone: "blue" },
  HOUSE_PURCHASE:   { icon: Home,          tone: "brown" },
  VEHICLE_PURCHASE: { icon: Car,           tone: "cyan" },
  VACATION:         { icon: Plane,         tone: "teal" },
  CHILD_FUTURE:     { icon: Baby,          tone: "pink" },
  TAX_SAVINGS:      { icon: Receipt,       tone: "green" },
  INVESTMENT:       { icon: TrendingUp,    tone: "indigo" },
  GENERAL_SAVINGS:  { icon: Wallet,        tone: "mint" },
  WEDDING:          { icon: Heart,         tone: "magenta" },
  MEDICAL:          { icon: Stethoscope,   tone: "red" },
  DEBT_PAYOFF:      { icon: TrendingDown,  tone: "cobalt" },
  HOME_RENOVATION:  { icon: Hammer,        tone: "yellow" },
  DAILY_SPENDING:   { icon: ShoppingBag,   tone: "azure" },
  CUSTOM:           { icon: Sparkles,      tone: "gray" },
};

/** Resolves a purpose (+ its free-text label when purpose is CUSTOM) to display text.
 * Returns null when there's no purpose to show at all. */
export function resolvePurposeLabel(
  purpose: string | null | undefined,
  customLabel?: string | null,
): string | null {
  if (!purpose) return null;
  if (purpose === "CUSTOM") return customLabel?.trim() || "Custom";
  return PURPOSE_LABELS[purpose] ?? purpose;
}
