"use client";

import type {LucideIcon} from "lucide-react";
import {badgeTextColor} from "@/components/icons/PremiumIcon";
import {useIsDark} from "@/hooks/useIsDark";
import {cn} from "@/lib/utils";

interface CategoryRingProps {
  icon: LucideIcon;
  hex: string;
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CategoryRingProps["size"]>, { box: string; icon: string }> = {
  sm: { box: "w-9 h-9",  icon: "w-4 h-4" },
  lg: { box: "w-12 h-12", icon: "w-5 h-5" },
};

// Circular, pastel-tinted category badge for the Transactions page's rows and detail drawer —
// a deliberate, separate visual treatment from the app-wide PremiumIcon/GlossyBadge "vivid
// gradient sticker" look used everywhere else, scoped to this page only rather than a global
// icon-system change. Reuses the exact tint-alpha ("20" ≈ 12.5%) + badgeTextColor contrast pairing
// already calibrated and proven accessible for this app's category pills (see PremiumIcon.tsx's
// badgeTextColor doc comment) rather than inventing new, unverified contrast math.
export function CategoryRing({ icon: Icon, hex, size = "sm", className }: CategoryRingProps) {
  const isDark = useIsDark();
  const s = SIZE_CLASSES[size];
  return (
    <div className={cn("rounded-full flex items-center justify-center shrink-0", s.box, className)}
      style={{ backgroundColor: hex + "20" }}>
      <Icon className={s.icon} style={{ color: badgeTextColor(hex, isDark) }} strokeWidth={2.25} />
    </div>
  );
}
