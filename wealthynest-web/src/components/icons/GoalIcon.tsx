import { resolveGoalIcon, GOAL_COLORS } from "@/lib/categoryMeta";
import { PremiumIcon, type IconStateProps, type IconSize } from "./PremiumIcon";

interface GoalIconProps extends IconStateProps {
  /** Goal name — drives the keyword-matched icon fallback (e.g. "Buy a car" → Car). */
  name: string;
  /** Explicit icon key from GOAL_ICON_OPTIONS, if the goal has one set. */
  icon?: string | null;
  /** Explicit color, if the goal has one set. */
  color?: string | null;
  /** Position in a goals list — cycles GOAL_COLORS the same way GoalsSummary's progress rings do, so a goal keeps the same color in both places. Ignored when `color` is set. */
  index?: number;
  size?: IconSize;
  className?: string;
}

function hashToIndex(value: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash) % length;
}

// Resolves a goal (built-in preset or user-named) to its icon/color — icon via
// `resolveGoalIcon` (explicit pick, then name keyword match), color via the
// same GOAL_COLORS cycle GoalsSummary's rings use, keyed by list position when
// given, otherwise a stable hash of the name so a lone goal doesn't always
// render the same color regardless of name.
export function GoalIcon({ name, icon, color, index, size, ...state }: GoalIconProps) {
  const resolvedIcon = resolveGoalIcon({ name, icon });
  const resolvedColor = color ?? GOAL_COLORS[index !== undefined ? index % GOAL_COLORS.length : hashToIndex(name, GOAL_COLORS.length)];
  return <PremiumIcon icon={resolvedIcon} hex={resolvedColor} size={size} {...state} />;
}
