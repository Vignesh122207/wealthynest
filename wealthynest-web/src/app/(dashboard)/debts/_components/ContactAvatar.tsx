import {GlossyBadge, TONE_HEX} from "@/components/icons/PremiumIcon";

// ── Contact avatar — monogram badge, consistent with BankLogo's fallback look ──

export function ContactAvatar({ name, isLent, size = 44 }: { name: string; isLent: boolean; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <GlossyBadge hex={isLent ? TONE_HEX.emerald : TONE_HEX.red} className="shrink-0" size="md">
      <span className="relative text-white font-bold text-base" style={{ fontSize: size * 0.36 }}>{initial}</span>
    </GlossyBadge>
  );
}
