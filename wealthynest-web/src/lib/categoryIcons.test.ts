import { describe, it, expect } from "vitest";
import {
  getCategoryIconByKey, suggestUnusedCombo, findDuplicateCategory,
  categoriesUsingIcon, categoriesUsingColor, CATEGORY_ICON_LIST, CATEGORY_COLOR_PALETTE,
} from "./categoryIcons";
import { ShoppingCart } from "lucide-react";

describe("getCategoryIconByKey", () => {
  it("resolves a known key", () => {
    expect(getCategoryIconByKey("shopping-cart")).toBe(ShoppingCart);
  });

  it("returns undefined for an unknown key", () => {
    expect(getCategoryIconByKey("not-a-real-key")).toBeUndefined();
  });

  it("returns undefined for a null/undefined key", () => {
    expect(getCategoryIconByKey(null)).toBeUndefined();
    expect(getCategoryIconByKey(undefined)).toBeUndefined();
  });
});

describe("suggestUnusedCombo", () => {
  it("returns the first registry (icon, color) pair when nothing is used yet", () => {
    const combo = suggestUnusedCombo([]);
    expect(combo.icon).toBe(CATEGORY_ICON_LIST[0].key);
    expect(combo.color).toBe(CATEGORY_COLOR_PALETTE[0]);
  });

  it("skips a combination already used exactly (same icon AND color)", () => {
    const existing = [{ icon: CATEGORY_ICON_LIST[0].key, color: CATEGORY_COLOR_PALETTE[0] }];
    const combo = suggestUnusedCombo(existing);
    expect(combo).not.toEqual({ icon: CATEGORY_ICON_LIST[0].key, color: CATEGORY_COLOR_PALETTE[0] });
  });

  it("is case-insensitive when comparing colors: an uppercase-recorded color still blocks the lowercase match", () => {
    const existing = [{ icon: CATEGORY_ICON_LIST[0].key, color: CATEGORY_COLOR_PALETTE[0].toUpperCase() }];
    const combo = suggestUnusedCombo(existing);
    // Same color slot is still offered (with the next icon) — only the exact (icon, color) pair is excluded
    expect(combo).not.toEqual({ icon: CATEGORY_ICON_LIST[0].key, color: CATEGORY_COLOR_PALETTE[0] });
    expect(combo.icon).toBe(CATEGORY_ICON_LIST[1].key);
  });

  it("ignores entries missing either an icon or a color", () => {
    const existing = [{ icon: CATEGORY_ICON_LIST[0].key, color: null }, { icon: null, color: CATEGORY_COLOR_PALETTE[0] }];
    const combo = suggestUnusedCombo(existing);
    expect(combo.icon).toBe(CATEGORY_ICON_LIST[0].key);
    expect(combo.color).toBe(CATEGORY_COLOR_PALETTE[0]);
  });
});

describe("findDuplicateCategory", () => {
  const categories = [
    { id: "1", icon: "car", color: "#007AFF" },
    { id: "2", icon: "car", color: "#34C759" },
  ];

  it("finds a category with an exact icon+color match", () => {
    const dup = findDuplicateCategory(categories, "car", "#007AFF");
    expect(dup?.id).toBe("1");
  });

  it("is case-insensitive on color", () => {
    const dup = findDuplicateCategory(categories, "car", "#007aff");
    expect(dup?.id).toBe("1");
  });

  it("does not match on icon-only or color-only overlap", () => {
    expect(findDuplicateCategory(categories, "car", "#000000")).toBeUndefined();
  });

  it("excludes the given id (editing a category shouldn't collide with itself)", () => {
    expect(findDuplicateCategory(categories, "car", "#007AFF", "1")).toBeUndefined();
  });
});

describe("categoriesUsingIcon / categoriesUsingColor", () => {
  const categories = [
    { id: "1", name: "A", icon: "car", color: "#007AFF" },
    { id: "2", name: "B", icon: "car", color: "#34C759" },
    { id: "3", name: "C", icon: "home", color: "#007AFF" },
  ];

  it("categoriesUsingIcon finds all categories sharing an icon", () => {
    expect(categoriesUsingIcon(categories, "car").map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("categoriesUsingIcon excludes the given id", () => {
    expect(categoriesUsingIcon(categories, "car", "1").map((c) => c.id)).toEqual(["2"]);
  });

  it("categoriesUsingColor finds all categories sharing a color, case-insensitively", () => {
    expect(categoriesUsingColor(categories, "#007aff").map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("categoriesUsingColor excludes the given id", () => {
    expect(categoriesUsingColor(categories, "#007AFF", "3").map((c) => c.id)).toEqual(["1"]);
  });
});
