import {cn} from "@/lib/utils";
import type {LucideIcon} from "lucide-react";

// ── Premium icon tones — Apple's iOS system-color palette (light + dark
// variants), the vivid "candy" look the app is designed around. 12 families ×
// 2 shades gives 20 genuinely distinct, good-looking colors, so a list with
// up to 20 items can still assign every item its own unique tone without
// resorting to a duller, more mathematically-even color wheel.
export type IconTone =
  | "red" | "orange" | "yellow" | "green" | "mint" | "teal"
  | "cyan" | "blue" | "indigo" | "purple" | "pink" | "brown"
  | "coral" | "lemon" | "emerald" | "turquoise" | "azure" | "cobalt"
  | "violet" | "magenta" | "gray";

export const TONE_HEX: Record<IconTone, string> = {
  red:       "#FF3B30",
  orange:    "#FF9500",
  yellow:    "#FFCC00",
  green:     "#34C759",
  mint:      "#00C7BE",
  teal:      "#30B0C7",
  cyan:      "#32ADE6",
  blue:      "#007AFF",
  indigo:    "#5856D6",
  purple:    "#AF52DE",
  pink:      "#FF2D55",
  brown:     "#A2845E",
  coral:     "#FF9F0A", // orange, dark-mode shade
  lemon:     "#FFD60A", // yellow, dark-mode shade
  emerald:   "#30D158", // green, dark-mode shade
  turquoise: "#63E6E2", // mint, dark-mode shade
  azure:     "#64D2FF", // cyan, dark-mode shade
  cobalt:    "#0A84FF", // blue, dark-mode shade
  violet:    "#5E5CE6", // indigo, dark-mode shade
  magenta:   "#FF375F", // pink, dark-mode shade
  gray:      "#8E8E93", // neutral — desaturated, never competes with the above
};

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export const SIZE_MAP: Record<IconSize, { box: string; icon: string; radius: string; shine: string }> = {
  xs: { box: "w-6 h-6",   icon: "w-3.5 h-3.5", radius: "rounded-lg", shine: "w-2.5 h-2.5" },
  sm: { box: "w-8 h-8",   icon: "w-4 h-4",   radius: "rounded-xl",  shine: "w-3 h-3" },
  md: { box: "w-11 h-11", icon: "w-5 h-5",   radius: "rounded-2xl", shine: "w-4 h-4" },
  lg: { box: "w-14 h-14", icon: "w-7 h-7",   radius: "rounded-2xl", shine: "w-5 h-5" },
  xl: { box: "w-16 h-16", icon: "w-8 h-8",   radius: "rounded-[1.25rem]", shine: "w-6 h-6" },
};

export function lighten(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix((num >> 16) & 255), g = mix((num >> 8) & 255), b = mix(num & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

export function darken(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  const r = mix((num >> 16) & 255), g = mix((num >> 8) & 255), b = mix(num & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

// Category/type/income-source badges render `color: rawHex` as text against a background
// tinted with that same raw hex at ~8-12% alpha — the tint barely moves the card's luminance,
// so the raw palette hue alone has to carry 4.5:1 contrast, and most of TONE_HEX's "vivid candy"
// colors don't: axe caught indigo/violet at ~2.8-3.5:1 in dark mode, and separately (unexercised
// by any CI run yet, since the app's ThemeProvider defaultTheme is "dark" — see app/layout.tsx)
// nearly the whole palette fails in light mode against a near-white card (e.g. lemon 1.4:1).
// Verified against every TONE_HEX/GOAL_COLORS/VAULT_CATEGORY_META value at the highest tint alpha
// used by any call site (12.5%): lightening 30% clears 4.5:1 in dark mode (worst case indigo at
// 5.05:1), darkening 50% clears it in light mode (worst case lemon at 4.97:1).
export function badgeTextColor(hex: string, isDark: boolean): string {
  return isDark ? lighten(hex, 0.3) : darken(hex, 0.5);
}

// Shared interactive-state contract for every icon in the system — a plain
// display badge by default; opting into `interactive` makes it a pressable
// control (hover lift + press-in), `selected` gives it a persistent "chosen"
// glow independent of hover, `disabled` desaturates it and blocks input.
export interface IconStateProps {
  /** Hover lift/scale + press-in animation. Set on icons used as buttons/nav/menu items. */
  interactive?: boolean;
  /** Persistent glow + slight scale, independent of hover — e.g. the active option in a picker. */
  selected?: boolean;
  /** Desaturates, flattens the shadow, blocks pointer/keyboard interaction. */
  disabled?: boolean;
  onClick?: () => void;
  /** `true` for a plain unread dot, a number for a count pill (capped "9+"). Unset/0/false renders nothing. */
  badge?: number | boolean;
}

interface GlossyBadgeProps extends IconStateProps {
  /** Single color — the badge auto-tints a lighter top-left stop from this. Ignored when `gradient` is set. */
  hex?: string;
  /** Explicit two-stop diagonal gradient (e.g. nav tiles wanting a real "Purple → Indigo" look, not an auto-tint of one hue). */
  gradient?: [string, string];
  size?: IconSize;
  className?: string;
  children: React.ReactNode;
}

// The shared glossy gradient shell — color-matched drop shadow, soft top-left
// highlight — used by both PremiumIcon (a lucide glyph) and BankLogo (an
// initials monogram), so the two always look like one consistent system.
export function GlossyBadge({ hex, gradient, size = "md", interactive, selected, disabled, onClick, badge, className, children }: GlossyBadgeProps) {
  const s = SIZE_MAP[size];
  const clickable = interactive && !!onClick && !disabled;
  // Shadow/glow color always comes from the deepest stop — for a plain hex
  // that's the hex itself, for a gradient it's the `to` color, which reads as
  // the tile's dominant hue.
  const glowHex = gradient ? gradient[1] : hex ?? TONE_HEX.gray;
  const [from, to] = gradient ?? [lighten(glowHex, 0.4), glowHex];

  // Shadow depth is expressed as CSS custom properties so hover/active/focus
  // can switch between tiers with plain Tailwind classes instead of JS state —
  // no re-render needed to animate the press.
  const cssVars: Record<string, string> = {};
  let boxShadow: string;
  if (disabled) {
    boxShadow = "0 2px 6px -2px rgba(0,0,0,0.12)";
  } else {
    cssVars["--shadow-rest"] = `0 8px 16px -6px ${glowHex}80`;
    cssVars["--shadow-hover"] = `0 16px 32px -8px ${glowHex}99`;
    cssVars["--shadow-press"] = `0 4px 8px -4px ${glowHex}66`;
    cssVars["--shadow-selected"] = `0 10px 22px -6px ${glowHex}99, 0 0 0 3px ${glowHex}40`;
    boxShadow = `var(${selected ? "--shadow-selected" : "--shadow-rest"})`;
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); }
      } : undefined}
      className={cn(
        "relative flex items-center justify-center shrink-0 overflow-hidden transition-all duration-200 ease-out",
        s.box, s.radius,
        interactive && !disabled && [
          "cursor-pointer",
          "hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[var(--shadow-hover)]",
          "group-hover:-translate-y-0.5 group-hover:scale-[1.04] group-hover:shadow-[var(--shadow-hover)]",
          "active:translate-y-0 active:scale-[0.95] active:duration-100 active:shadow-[var(--shadow-press)]",
          clickable && "focus-visible:outline-none focus-visible:shadow-[var(--shadow-hover)]",
        ],
        selected && !disabled && "scale-[1.03]",
        disabled && "grayscale opacity-40 saturate-50 pointer-events-none cursor-not-allowed",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        boxShadow,
        ...cssVars,
      } as React.CSSProperties}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/0 to-black/10" />
      <div className={cn("absolute -top-1.5 -left-1.5 rounded-full bg-white/40 blur-md", s.shine)} />
      {children}
      {badge === true && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[hsl(var(--sidebar-bg))] z-10" />
      )}
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-[hsl(var(--sidebar-bg))] z-10">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </div>
  );
}

export interface PremiumIconProps extends IconStateProps {
  icon: LucideIcon;
  /** Named tone from the Apple system-color palette. Ignored when `hex` or `gradient` is set. */
  tone?: IconTone;
  /** Raw hex for callers with per-item dynamic colors (e.g. user categories) — builds the same glossy gradient around that color instead of a named tone. */
  hex?: string;
  /** Explicit two-stop diagonal gradient, e.g. `["#a855f7", "#6366f1"]` for Purple → Indigo. Takes precedence over `hex`/`tone`. */
  gradient?: [string, string];
  size?: IconSize;
  className?: string;
}

// Glossy gradient badge, filled white glyph — the "premium" replacement for
// the plain outline lucide icons used across the dashboard.
export function PremiumIcon({ icon: Icon, tone, hex, gradient, size = "md", interactive, selected, disabled, onClick, badge, className }: PremiumIconProps) {
  const resolvedHex = hex ?? TONE_HEX[tone ?? "gray"];
  return (
    <GlossyBadge hex={gradient ? undefined : resolvedHex} gradient={gradient} size={size} interactive={interactive} selected={selected} disabled={disabled} onClick={onClick} badge={badge} className={className}>
      <Icon className={cn(SIZE_MAP[size].icon, "relative text-white")} strokeWidth={2.25} />
    </GlossyBadge>
  );
}
