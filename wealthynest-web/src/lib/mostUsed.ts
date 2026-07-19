/** Builds a usage-frequency map (key → how many times it appears in `items`). */
export function buildUsageCounts<T>(items: T[], keyOf: (item: T) => string | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const key = keyOf(item);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

/** Sorts items by usage frequency, most-used first. Array.sort is stable, so ties (including
 * items with no recorded usage) keep their original relative order. */
export function sortByUsage<T>(items: T[], keyOf: (item: T) => string, usageCounts: Map<string, number>): T[] {
  return [...items].sort((a, b) => (usageCounts.get(keyOf(b)) ?? 0) - (usageCounts.get(keyOf(a)) ?? 0));
}

/** Smart default for a picker: the key from the most recent item (by `dateOf`, tiebroken by
 * `createdAtOf`), falling back to whichever key is used most often overall when the most recent
 * item doesn't have one (e.g. an uncategorized expense). Undefined when there's no history yet. */
export function pickSmartDefault<T>(
  items: T[],
  dateOf: (item: T) => string,
  createdAtOf: (item: T) => string,
  keyOf: (item: T) => string | undefined,
): string | undefined {
  if (items.length === 0) return undefined;
  const mostRecent = [...items].sort((a, b) =>
    dateOf(b).localeCompare(dateOf(a)) || createdAtOf(b).localeCompare(createdAtOf(a)))[0];
  const recentKey = keyOf(mostRecent);
  if (recentKey) return recentKey;
  const counts = buildUsageCounts(items, keyOf);
  let best: string | undefined, bestCount = 0;
  counts.forEach((count, key) => { if (count > bestCount) { best = key; bestCount = count; } });
  return best;
}
