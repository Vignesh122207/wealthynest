import {getCategoryColor, getCategoryIcon} from "@/lib/categoryMeta";
import {type IconSize, type IconStateProps, PremiumIcon} from "./PremiumIcon";

interface CategoryIconProps extends IconStateProps {
  /** Category name — drives the keyword-matched icon/color fallback. */
  name: string;
  /** Explicit icon key from the shared registry (lib/categoryIcons.ts), if the category has one set. */
  icon?: string | null;
  /** Explicit color, if the category has one set. Same precedence callers already use elsewhere: color ?? keyword match. */
  color?: string | null;
  size?: IconSize;
  className?: string;
}

// Resolves an expense/income category (built-in or user-created) to its icon
// and color via the app's single category lookup (`lib/categoryMeta`) —
// matching what CategoryPicker and the transaction list already show.
export function CategoryIcon({ name, icon, color, size, ...state }: CategoryIconProps) {
  const resolvedIcon = getCategoryIcon({ name, icon });
  const resolvedColor = getCategoryColor(name, color ?? undefined);
  return <PremiumIcon icon={resolvedIcon} hex={resolvedColor} size={size} {...state} />;
}
