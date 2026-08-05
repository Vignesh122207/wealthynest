import type {VaultHealthSummary} from "../types/vault.types";

/** Distinct items affected by at least one Vault Health issue — an item flagged as e.g. both weak
 * and breached must only count once here. Summing reusedCount+weakCount+breachedCount (the naive
 * approach) overstates how many distinct items actually need attention whenever one item carries
 * more than one flag. */
export function countDistinctVaultIssues(health: VaultHealthSummary): number {
  const ids = new Set<string>();
  for (const item of health.reusedItems) ids.add(item.id);
  for (const item of health.weakItems) ids.add(item.id);
  for (const item of health.breachedItems) ids.add(item.id);
  return ids.size;
}
