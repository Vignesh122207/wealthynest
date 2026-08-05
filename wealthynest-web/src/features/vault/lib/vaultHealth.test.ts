import {describe, expect, it} from "vitest";
import {countDistinctVaultIssues} from "./vaultHealth";
import type {VaultHealthSummary} from "../types/vault.types";

function summary(overrides: Partial<VaultHealthSummary>): VaultHealthSummary {
  return {
    totalItems: 0, reusedCount: 0, weakCount: 0, breachedCount: 0,
    reusedItems: [], weakItems: [], breachedItems: [],
    ...overrides,
  };
}

describe("countDistinctVaultIssues", () => {
  it("returns 0 for a clean vault", () => {
    expect(countDistinctVaultIssues(summary({}))).toBe(0);
  });

  it("sums distinct items across categories when none overlap", () => {
    const health = summary({
      reusedItems: [{ id: "a", title: "A", itemType: "LOGIN" }],
      weakItems: [{ id: "b", title: "B", itemType: "LOGIN" }],
      breachedItems: [{ id: "c", title: "C", itemType: "LOGIN" }],
    });
    expect(countDistinctVaultIssues(health)).toBe(3);
  });

  it("counts an item flagged in multiple categories only once", () => {
    const health = summary({
      reusedItems: [{ id: "a", title: "A", itemType: "LOGIN" }],
      weakItems: [{ id: "a", title: "A", itemType: "LOGIN" }],
      breachedItems: [{ id: "a", title: "A", itemType: "LOGIN" }],
    });
    expect(countDistinctVaultIssues(health)).toBe(1);
  });

  it("handles a mix of overlapping and unique items", () => {
    const health = summary({
      reusedItems: [{ id: "a", title: "A", itemType: "LOGIN" }, { id: "b", title: "B", itemType: "LOGIN" }],
      weakItems: [{ id: "a", title: "A", itemType: "LOGIN" }],
      breachedItems: [{ id: "c", title: "C", itemType: "LOGIN" }],
    });
    expect(countDistinctVaultIssues(health)).toBe(3);
  });
});
