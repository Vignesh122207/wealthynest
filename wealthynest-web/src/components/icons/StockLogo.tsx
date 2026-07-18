"use client";

import {useState} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {getRealStockLogoFile, getStockMonogram} from "@/lib/stockLogos";
import {GlossyBadge, type IconSize, type IconTone, PremiumIcon, SIZE_MAP} from "./PremiumIcon";

interface StockLogoProps {
  /** NSE ticker (e.g. "ITC"). Unmatched or empty falls back to the generic icon. */
  symbol?: string;
  fallbackIcon: LucideIcon;
  fallbackTone?: IconTone;
  fallbackHex?: string;
  size?: IconSize;
  className?: string;
}

const TEXT_SIZE: Record<IconSize, string> = {
  xs: "text-[6px]", sm: "text-[7px]", md: "text-[9px]", lg: "text-[11px]", xl: "text-xs",
};

// Same three-tier fallback as BankLogo (real file → colored monogram → generic badge) — every
// stock currently renders the exact same TrendingUp icon regardless of company, so even the
// monogram tier alone (no real logo files yet) makes ITC, TCS, Reliance etc. visually distinct.
export function StockLogo({ symbol, fallbackIcon, fallbackTone, fallbackHex, size = "md", className }: StockLogoProps) {
  const realLogo = getRealStockLogoFile(symbol);
  const [errored, setErrored] = useState(false);

  if (realLogo && !errored) {
    const s = SIZE_MAP[size];
    return (
      <div className={cn("relative flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm border border-black/5 p-1", s.box, s.radius, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, not worth Next/Image's pipeline */}
        <img src={realLogo} alt={symbol} className="w-full h-full object-contain" onError={() => setErrored(true)} />
      </div>
    );
  }

  const monogram = getStockMonogram(symbol);
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
