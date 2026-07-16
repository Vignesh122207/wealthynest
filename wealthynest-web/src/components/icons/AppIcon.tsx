import { PremiumIcon } from "./PremiumIcon";

// The generic entry point into the icon system: any lucide glyph + a tone or
// hex. Every other named icon component (CategoryIcon, AccountIcon, MenuIcon,
// GoalIcon, InvestmentIcon) resolves its domain-specific lookup down to this
// same call — so there is exactly one place the badge itself is drawn.
export const AppIcon = PremiumIcon;
export type { PremiumIconProps as AppIconProps } from "./PremiumIcon";
