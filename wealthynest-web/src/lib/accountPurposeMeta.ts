import { PURPOSE_LABELS } from "@/features/accounts/schemas/account.schema";

// Unlike account types (each with its own icon/color), every purpose intentionally shares one
// visual treatment — a purpose is a tag, not a structural distinction. Per-purpose theming can
// be layered on later without a schema/API change if it turns out to earn its keep.
export const PURPOSE_CHIP_CLASS =
  "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20";

/** Resolves a purpose (+ its free-text label when purpose is CUSTOM) to display text.
 * Returns null when there's no purpose to show at all. */
export function resolvePurposeLabel(
  purpose: string | null | undefined,
  customLabel?: string | null,
): string | null {
  if (!purpose) return null;
  if (purpose === "CUSTOM") return customLabel?.trim() || "Custom";
  return PURPOSE_LABELS[purpose] ?? purpose;
}
