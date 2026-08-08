import {TONE_HEX} from "@/components/icons/PremiumIcon";

// ── Contact avatar — neutral 2-letter monogram (round, not a colored badge); `pct` wraps it in
// a payoff-progress ring (conic-gradient) instead of a separate progress bar elsewhere on the
// card, `overdue` adds a pulsing alert dot. A fully settled contact doesn't get a card at all
// (see page.tsx's activeGroups filter) — their history lives in the page-level Settled section
// instead — so there's no "settled" badge state here to render.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ContactAvatar({ name, isLent, size = 44, pct, overdue }: {
  name: string; isLent: boolean; size?: number; pct?: number; overdue?: boolean;
}) {
  const initials = initialsOf(name);
  const hex = isLent ? TONE_HEX.emerald : TONE_HEX.red;
  const badge = (
    <div className="shrink-0 w-11 h-11 rounded-full border border-border bg-card flex items-center justify-center">
      <span className="font-bold text-foreground" style={{ fontSize: size * 0.32 }}>{initials}</span>
    </div>
  );

  if (pct === undefined) return badge;

  const clampedPct = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="relative shrink-0">
      <div className="rounded-full p-[3px]" style={{
        background: `conic-gradient(${hex} ${clampedPct * 3.6}deg, hsl(var(--progress-bg)) 0deg)`,
      }}>
        {badge}
      </div>
      {overdue && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-[hsl(var(--card))] animate-pulse" />
      )}
    </div>
  );
}
