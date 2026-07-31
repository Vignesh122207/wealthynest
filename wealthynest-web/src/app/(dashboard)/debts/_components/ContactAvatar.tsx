import {Check} from "lucide-react";
import {TONE_HEX} from "@/components/icons/PremiumIcon";

// ── Contact avatar — neutral 2-letter monogram (round, not a colored badge); `pct` wraps it in
// a payoff-progress ring (conic-gradient) instead of a separate progress bar elsewhere on the
// card, `settled` adds a small check badge over the ring.

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ContactAvatar({ name, isLent, size = 44, pct, settled }: {
  name: string; isLent: boolean; size?: number; pct?: number; settled?: boolean;
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
      {settled && (
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-[hsl(var(--card))]"
          style={{ background: hex }}>
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}
