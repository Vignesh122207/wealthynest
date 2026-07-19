"use client";

import {useState} from "react";
import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";
import {getBankMonogram, getLogoFit, getRealLogoFile} from "@/lib/bankLogos";
import {GlossyBadge, type IconSize, type IconTone, PremiumIcon, SIZE_MAP} from "./PremiumIcon";

interface BankLogoProps {
  /** Bank/broker name as typed or picked (e.g. "HDFC Bank"). Unmatched or empty falls back to the icon. */
  name?: string;
  /** Fallback glyph + tone when there's no known logo/monogram for `name`. */
  fallbackIcon: LucideIcon;
  fallbackTone?: IconTone;
  fallbackHex?: string;
  size?: IconSize;
  className?: string;
}

const TEXT_SIZE: Record<IconSize, string> = {
  xs: "text-[7px]", sm: "text-[8px]", md: "text-[10px]", lg: "text-xs", xl: "text-sm",
};

// Real bank/broker logo (public/bank-logos/) when we have one — square,
// symbol-only marks (no wordmark), mostly sourced from companieslogo.com's
// "icon" variant via each listed company's stock ticker — falling back to a
// colored monogram in the brand's real color, then to the generic gradient
// PremiumIcon badge for names we don't recognize at all. Clearbit's free
// logo API (the original plan) was discontinued with no replacement DNS
// record.
export function BankLogo({ name, fallbackIcon, fallbackTone, fallbackHex, size = "md", className }: BankLogoProps) {
  const realLogo = getRealLogoFile(name);
  const [errored, setErrored] = useState(false);

  if (realLogo && !errored) {
    const s = SIZE_MAP[size];
    const fit = getLogoFit(name);
    return (
      <div className={cn("relative flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm border border-black/5 p-1", s.box, s.radius, className)}>
        {/* object-cover, not object-contain: almost every file here is a true
            square symbol now, so it's a no-op for those — but a couple
            (Sharekhan, UCO) are still wide lockups with no better source
            found, and object-cover crops those to the left mark instead of
            shrinking the whole lockup down to an illegible sliver. A few
            names (see LOGO_FIT_OVERRIDES) need object-contain instead, when
            their mark is drawn edge-to-edge and cover would crop it. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, not worth Next/Image's pipeline */}
        <img src={realLogo} alt={name} className={cn("w-full h-full object-left", fit === "contain" ? "object-contain" : "object-cover")} onError={() => setErrored(true)} />
      </div>
    );
  }

  const monogram = getBankMonogram(name);
  if (!monogram) {
    return <PremiumIcon icon={fallbackIcon} tone={fallbackTone} hex={fallbackHex} size={size} className={className} />;
  }

  return (
    <GlossyBadge hex={monogram.hex} size={size} className={className}>
      <span className={cn("relative font-extrabold text-white tracking-tight leading-none", TEXT_SIZE[size])}>
        {monogram.initials}
      </span>
    </GlossyBadge>
  );
}
