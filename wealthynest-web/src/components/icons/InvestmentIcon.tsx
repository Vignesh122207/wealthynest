import type { InvestmentType } from "@/features/investments/types/investment.types";
import { INVESTMENT_TYPE_META } from "@/lib/investmentTypeMeta";
import { PremiumIcon, type IconStateProps, type IconSize } from "./PremiumIcon";

interface InvestmentIconProps extends IconStateProps {
  type: InvestmentType;
  size?: IconSize;
  className?: string;
}

// Resolves an investment holding's type to its icon/color via
// INVESTMENT_TYPE_META — the single source of truth also used by the
// Investments page's allocation chart, so colors never shift between the two.
export function InvestmentIcon({ type, size, ...state }: InvestmentIconProps) {
  const meta = INVESTMENT_TYPE_META[type];
  return <PremiumIcon icon={meta.icon} hex={meta.hex} size={size} {...state} />;
}
