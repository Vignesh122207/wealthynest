import type {AccountType} from "@/features/accounts/types/account.types";
import {ACCOUNT_TYPE_META} from "@/lib/accountTypeMeta";
import {type IconSize, type IconStateProps, PremiumIcon} from "./PremiumIcon";

interface AccountIconProps extends IconStateProps {
  type: AccountType;
  size?: IconSize;
  className?: string;
}

// Resolves a wallet account's type to its icon/color via ACCOUNT_TYPE_META —
// the single source of truth also used by the Accounts page and dashboard's
// Wallet Overview widget, so this never drifts from those.
export function AccountIcon({ type, size, ...state }: AccountIconProps) {
  const meta = ACCOUNT_TYPE_META[type];
  return <PremiumIcon icon={meta.icon} hex={meta.hex} size={size} {...state} />;
}
