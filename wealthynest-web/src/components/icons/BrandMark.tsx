import {useId} from "react";
import {cn} from "@/lib/utils";

// The W's four strokes, each an independently rotated bar (translate + rotate
// a rect around its own midpoint) rather than one mitred path — avoids
// hand-mitring the join geometry while still reading as one continuous
// ribbon. Kept in sync with the source SVGs at public/icons/icon-192.svg /
// icon-maskable.svg so the app/PWA icon and the in-app logo render
// identically. "duo" is the real two-tone indigo→violet ribbon — the app's
// existing brand color, so this mark needed no app-wide repaint to stay
// consistent; "mono" is a flat currentColor version for contexts (the glass
// variant, monochrome icons) where a two-color gradient glyph doesn't apply.
const W_LEGS = [
  {tx: 63, ty: 114, rot: 71.9, len: 122.07, id: "a"},
  {tx: 91, ty: 134, rot: -76.7, len: 78.1, id: "b"},
  {tx: 109, ty: 134, rot: 76.7, len: 78.1, id: "c"},
  {tx: 137, ty: 114, rot: -71.9, len: 122.07, id: "d"},
] as const;

const W_STOPS: Record<(typeof W_LEGS)[number]["id"], [string, string]> = {
  a: ["#818cf8", "#4f46e5"],
  b: ["#4f46e5", "#818cf8"],
  c: ["#a78bfa", "#6d28d9"],
  d: ["#6d28d9", "#7c3aed"],
};

function RibbonWMark({ className, tone = "duo" }: { className?: string; tone?: "duo" | "mono" }) {
  const uid = useId();
  return (
    <svg viewBox="0 0 200 200" className={className} fill="currentColor" aria-hidden="true">
      {tone === "duo" && (
        <defs>
          {W_LEGS.map((leg) => {
            const [from, to] = W_STOPS[leg.id];
            const half = leg.len / 2;
            return (
              <linearGradient key={leg.id} id={`w-${leg.id}-${uid}`} x1={-half} y1="0" x2={half} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </linearGradient>
            );
          })}
        </defs>
      )}
      {W_LEGS.map((leg) => (
        <g key={leg.id} transform={`translate(${leg.tx} ${leg.ty}) rotate(${leg.rot})`}>
          <rect x={-leg.len / 2} y={-13} width={leg.len} height={26} rx={9} fill={tone === "duo" ? `url(#w-${leg.id}-${uid})` : "currentColor"} />
        </g>
      ))}
    </svg>
  );
}

// The WealthyNest brand mark — a two-tone indigo→violet ribbon W on a
// near-black tile, matching the PWA icon (public/icons/icon-192.svg) and the
// in-app Sidebar so the logo reads identically everywhere.
// "glass" exists for placing the mark directly on the app's own indigo/violet
// gradient panels (the auth-page brand column) — a colored badge would nearly
// vanish against a same-hue backdrop there, so it falls back to the
// translucent white chip already used by the nearby perk icons in that panel,
// with the mono (flat currentColor) version of the glyph.
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
        <RibbonWMark tone="mono" className={cn("text-white", iconClassName)} />
      </div>
    );
  }
  return (
    <div
      className={cn(roundedClassName, "relative overflow-hidden flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0", boxClassName)}
      style={{background: "radial-gradient(120% 120% at 30% 20%, #161616 0%, #000000 70%)"}}
    >
      <RibbonWMark tone="duo" className={cn("relative", iconClassName)} />
    </div>
  );
}
