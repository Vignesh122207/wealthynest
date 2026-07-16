"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRealFundLogoFile, getFundHouseMonogram } from "@/lib/fundHouseLogos";
import { PremiumIcon, GlossyBadge, SIZE_MAP, type IconSize, type IconTone } from "./PremiumIcon";

interface FundLogoProps {
  /** Full scheme name as returned by the NAV search (e.g. "HDFC Flexi Cap Fund - Growth"). */
  companyName?: string;
  fallbackIcon: LucideIcon;
  fallbackTone?: IconTone;
  fallbackHex?: string;
  size?: IconSize;
  className?: string;
}

const TEXT_SIZE: Record<IconSize, string> = {
  xs: "text-[6px]", sm: "text-[7px]", md: "text-[9px]", lg: "text-[11px]", xl: "text-xs",
};

// Same three-tier fallback as StockLogo/BankLogo (real file → colored monogram → generic
// badge), matched by AMC-name prefix instead of an exact key since companyName is a full
// scheme name, not a picked value — see fundHouseLogos.ts.
export function FundLogo({ companyName, fallbackIcon, fallbackTone, fallbackHex, size = "md", className }: FundLogoProps) {
  const realLogo = getRealFundLogoFile(companyName);
  const [errored, setErrored] = useState(false);

  if (realLogo && !errored) {
    const s = SIZE_MAP[size];
    return (
      <div className={cn("relative flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm border border-black/5 p-1", s.box, s.radius, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, not worth Next/Image's pipeline */}
        <img src={realLogo} alt={companyName} className="w-full h-full object-contain" onError={() => setErrored(true)} />
      </div>
    );
  }

  const monogram = getFundHouseMonogram(companyName);
  if (!monogram) {
    return <PremiumIcon icon={fallbackIcon} tone={fallbackTone} hex={fallbackHex} size={size} className={className} />;
  }

  return (
    <GlossyBadge hex={monogram.hex} size={size} className={className}>
      <span className={cn("relative font-extrabold text-white tracking-tight leading-none text-center px-0.5", TEXT_SIZE[size])}>
        {monogram.initials}
      </span>
    </GlossyBadge>
  );
}
