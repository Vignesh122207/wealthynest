import { ICONS } from "./iconRegistry";
import { PremiumIcon, type IconStateProps, type IconSize } from "./PremiumIcon";

interface MenuIconProps extends IconStateProps {
  /** Nav item key from iconRegistry's "nav" group, e.g. "overview", "accounts", "settings". */
  item: string;
  size?: IconSize;
  className?: string;
}

// Resolves a sidebar/mobile-nav item key to its icon+tone via iconRegistry —
// each nav item keeps its own fixed tone (see ICON_CATEGORIES["nav"]) so the
// menu reads as a consistent set rather than reusing one brand color everywhere.
export function MenuIcon({ item, size, ...state }: MenuIconProps) {
  const entry = ICONS[item];
  if (!entry) return null;
  return <PremiumIcon icon={entry.icon} tone={entry.tone} size={size} {...state} />;
}
