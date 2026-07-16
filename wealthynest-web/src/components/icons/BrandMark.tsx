import { cn } from "@/lib/utils";

// The mark itself — a sprout rising from a nest, echoing "WealthyNest" directly
// rather than the generic plant-in-a-circle most finance apps use. Kept in sync
// with the source SVGs at public/icons/icon-192.svg / icon-maskable.svg so the
// app/PWA icon and the in-app logo render identically.
function NestSproutMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <g transform="translate(50 50) scale(0.85) translate(-50 -55)">
        <path d="M50 50 C36 50 20 40 16 22 C34 24 48 32 50 50 Z" />
        <path d="M50 50 C64 50 80 40 84 22 C66 24 52 32 50 50 Z" />
        <path d="M10 54 Q50 42 90 54 C90 72 72 88 50 88 C28 88 10 72 10 54 Z" />
      </g>
    </svg>
  );
}

// The WealthyNest brand mark — the same indigo→violet gradient used by the
// PWA icon (public/icons/icon-192.svg) and the in-app Sidebar, so the logo
// reads identically everywhere instead of drifting to the separate flat
// green treatment auth/landing pages had accumulated. Deliberately a plain
// flat gradient square (not the glossy GlossyBadge shine/shadow treatment
// used for nav icons elsewhere) — the logo reads cleaner without it.
// "glass" exists for placing the mark directly on the app's own indigo/violet
// gradient panels (the auth-page brand column) — a colored badge would nearly
// vanish against a same-hue backdrop there, so it falls back to the
// translucent white chip already used by the nearby perk icons in that panel.
export function BrandMark({ variant = "gradient", boxClassName, iconClassName, roundedClassName = "rounded-xl" }: {
  variant?: "gradient" | "glass";
  boxClassName: string;
  iconClassName: string;
  /** rounded-xl (12px) is a fixed radius — on a box 24px or smaller its corner arcs meet at the
   * midpoint of each edge and the "square" renders as a perfect circle. Pass a smaller radius
   * class (e.g. "rounded-lg") for any box under ~28px so it stays visibly square-with-blended-
   * corners instead. */
  roundedClassName?: string;
}) {
  if (variant === "glass") {
    return (
      <div className={cn(roundedClassName, "bg-white/15 flex items-center justify-center shrink-0", boxClassName)}>
        <NestSproutMark className={cn("text-white", iconClassName)} />
      </div>
    );
  }
  return (
    <div className={cn(roundedClassName, "bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0", boxClassName)}>
      <NestSproutMark className={cn("text-white", iconClassName)} />
    </div>
  );
}
