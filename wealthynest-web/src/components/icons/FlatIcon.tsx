"use client";

import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {useIsDark} from "@/hooks/useIsDark";
import {badgeTextColor, type IconTone, TONE_HEX} from "@/components/icons/PremiumIcon";

export type FlatIconSize = "xs" | "sm" | "md";

const SIZE_MAP: Record<FlatIconSize, { box: string; icon: string }> = {
  xs: { box: "w-6 h-6", icon: "w-3.5 h-3.5" },
  sm: { box: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { box: "w-9 h-9", icon: "w-4 h-4" },
};

interface FlatIconProps {
  icon: LucideIcon;
  /** Named tone from PremiumIcon's own palette. Ignored when `hex` is set. */
  tone?: IconTone;
  /** Raw hex for per-item dynamic colors (category/account-type/investment-type). */
  hex?: string;
  size?: FlatIconSize;
  className?: string;
}

// Quiet, tinted-glyph icon — the flatter sibling to PremiumIcon's glossy gradient badges, for
// places that want icons to recede (a stat row, a compact list) rather than compete for
// attention. Same tone/hex contract as PremiumIcon so call sites can swap directly; reuses its
// badgeTextColor helper for the same already-verified 4.5:1 contrast in both themes.
export function FlatIcon({ icon: Icon, tone, hex, size = "sm", className }: FlatIconProps) {
  const isDark = useIsDark();
  const resolvedHex = hex ?? TONE_HEX[tone ?? "gray"];
  const fg = badgeTextColor(resolvedHex, isDark);
  const s = SIZE_MAP[size];
  return (
    <div
      className={cn("flex items-center justify-center rounded-lg shrink-0", s.box, className)}
      style={{ backgroundColor: `${resolvedHex}1f` }}
    >
      <Icon className={s.icon} style={{ color: fg }} strokeWidth={2.1} />
    </div>
  );
}
