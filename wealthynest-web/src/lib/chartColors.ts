// Shared chart/data-series colors — single source of truth for the Home page's
// charts (allocation donut, trend lines, sparklines) so a future accent change
// doesn't require hunting through every chart component individually.
export const CHART_COLORS = {
  income:  "#10b981", // emerald — positive / growth (matches the app's income/gain text color)
  expense: "#f43f5e", // rose — negative / spend (matches the app's expense text color)
  saved:   "#818cf8", // light indigo — "saved" series, distinct from primary
  primary: "#6366f1", // indigo — brand / net worth / debt-adjacent
  warning: "#f59e0b", // amber — gold / attention
  neutral: "#94a3b8", // slate — "other" / unclassified
} as const;

// Categorical palette for multi-slice charts (asset/investment allocation donuts) — a fixed-order
// hue sequence assigned POSITIONALLY by rank (1st, 2nd, 3rd biggest slice…), never per-category.
// Assigning colors per-category (e.g. "Real Estate is always indigo") is what caused collisions
// before: Real Estate and Stocks were both #6366f1, and Cash & Bank / Mutual Funds / EPF-PPF were
// all #22c55e, whenever those categories happened to land in the same chart. Values are the
// design system's validated 8-slot categorical palette (CVD separation + contrast checked against
// this app's actual light/dark card surface via the dataviz skill's validator).
export const CATEGORICAL_PALETTE: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#eb6834", dark: "#d95926" }, // orange
];

export function categoricalColor(index: number, isDark: boolean): string {
  const slot = CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
  return isDark ? slot.dark : slot.light;
}

/**
 * Assigns positional categorical colors to slices (already sorted, largest first). Beyond the
 * palette's 8 slots, remaining slices fold into one trailing "Other" slice instead of cycling or
 * generating new hues — a 9th+ series was never meant to be its own distinguishable color.
 */
export function withCategoricalColors<T extends { name: string; value: number }>(
  slices: T[], isDark: boolean
): (T & { color: string })[] {
  const MAX = CATEGORICAL_PALETTE.length;
  if (slices.length <= MAX) {
    return slices.map((s, i) => ({ ...s, color: categoricalColor(i, isDark) }));
  }
  const kept  = slices.slice(0, MAX - 1).map((s, i) => ({ ...s, color: categoricalColor(i, isDark) }));
  const other = slices.slice(MAX - 1).reduce((sum, s) => sum + s.value, 0);
  return [...kept, { name: "Other", value: other, color: categoricalColor(MAX - 1, isDark) } as T & { color: string }];
}
