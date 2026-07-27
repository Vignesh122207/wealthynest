import { describe, it, expect } from "vitest";
import { buildUsageCounts, sortByUsage, pickSmartDefault } from "./mostUsed";

describe("buildUsageCounts", () => {
  it("counts occurrences of each key", () => {
    const items = [{ k: "a" }, { k: "b" }, { k: "a" }, { k: "a" }];
    const counts = buildUsageCounts(items, (i) => i.k);
    expect(counts.get("a")).toBe(3);
    expect(counts.get("b")).toBe(1);
  });

  it("skips items whose key is undefined", () => {
    const items = [{ k: "a" }, { k: undefined }];
    const counts = buildUsageCounts(items, (i) => i.k);
    expect(counts.get("a")).toBe(1);
    expect(counts.size).toBe(1);
  });

  it("returns an empty map for an empty array", () => {
    expect(buildUsageCounts([], () => "x").size).toBe(0);
  });
});

describe("sortByUsage", () => {
  it("sorts items most-used first", () => {
    const items = [{ k: "rare" }, { k: "common" }];
    const counts = new Map([["common", 5], ["rare", 1]]);
    const sorted = sortByUsage(items, (i) => i.k, counts);
    expect(sorted.map((i) => i.k)).toEqual(["common", "rare"]);
  });

  it("keeps original relative order for ties (stable sort)", () => {
    const items = [{ k: "a" }, { k: "b" }, { k: "c" }];
    const sorted = sortByUsage(items, (i) => i.k, new Map());
    expect(sorted.map((i) => i.k)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the original array", () => {
    const items = [{ k: "a" }, { k: "b" }];
    const counts = new Map([["b", 1]]);
    sortByUsage(items, (i) => i.k, counts);
    expect(items.map((i) => i.k)).toEqual(["a", "b"]);
  });
});

describe("pickSmartDefault", () => {
  type Item = { date: string; createdAt: string; key?: string };
  const dateOf = (i: Item) => i.date;
  const createdAtOf = (i: Item) => i.createdAt;
  const keyOf = (i: Item) => i.key;

  it("returns undefined for an empty history", () => {
    expect(pickSmartDefault([], dateOf, createdAtOf, keyOf)).toBeUndefined();
  });

  it("returns the key from the most recent item by date", () => {
    const items = [
      { date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", key: "old" },
      { date: "2026-02-01", createdAt: "2026-02-01T00:00:00Z", key: "new" },
    ];
    expect(pickSmartDefault(items, dateOf, createdAtOf, keyOf)).toBe("new");
  });

  it("tiebreaks equal dates by createdAt", () => {
    const items = [
      { date: "2026-01-01", createdAt: "2026-01-01T09:00:00Z", key: "earlier" },
      { date: "2026-01-01", createdAt: "2026-01-01T10:00:00Z", key: "later" },
    ];
    expect(pickSmartDefault(items, dateOf, createdAtOf, keyOf)).toBe("later");
  });

  it("falls back to the most-used key when the most recent item has none", () => {
    const items = [
      { date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", key: "frequent" },
      { date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", key: "frequent" },
      { date: "2026-02-01", createdAt: "2026-02-01T00:00:00Z", key: undefined },
    ];
    expect(pickSmartDefault(items, dateOf, createdAtOf, keyOf)).toBe("frequent");
  });

  it("returns undefined when no item (recent or historical) has a key", () => {
    const items = [{ date: "2026-01-01", createdAt: "2026-01-01T00:00:00Z", key: undefined }];
    expect(pickSmartDefault(items, dateOf, createdAtOf, keyOf)).toBeUndefined();
  });
});
