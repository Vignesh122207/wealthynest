import { describe, it, expect } from "vitest";
import {
  getCategoryMeta, getCategoryColor, getCategoryIcon,
  getGoalIcon, resolveGoalIcon, resolveVaultIcon,
} from "./categoryMeta";
import { ShoppingCart, Car, Package, Target, KeyRound, FileText } from "lucide-react";
import { CATEGORY_ICON_MAP } from "./categoryIcons";

describe("getCategoryMeta", () => {
  it("matches a keyword case-insensitively", () => {
    expect(getCategoryMeta("Grocery Shopping").icon).toBe(ShoppingCart);
    expect(getCategoryMeta("GROCERY").icon).toBe(ShoppingCart);
  });

  it("matches a substring, not just a whole-word keyword", () => {
    expect(getCategoryMeta("My Petrol Bunk").icon).toBe(Car);
  });

  it("falls back to the default meta for an unrecognized name", () => {
    const meta = getCategoryMeta("Project Phoenix");
    expect(meta.icon).toBe(Package);
    expect(meta.color).toBe("#6366f1");
  });

  it("does not match 'travel' generically — Transport and Travel/Vacation are distinct", () => {
    expect(getCategoryMeta("Travel").icon).not.toBe(Car);
  });
});

describe("getCategoryColor", () => {
  it("returns the curated color for a recognized name, ignoring any fallback", () => {
    expect(getCategoryColor("Grocery", "#000000")).toBe("#34C759");
  });

  it("returns the caller-supplied fallback for an unrecognized name", () => {
    expect(getCategoryColor("Project Phoenix", "#ABCDEF")).toBe("#ABCDEF");
  });

  it("returns the default color when unrecognized and no fallback given", () => {
    expect(getCategoryColor("Project Phoenix")).toBe("#6366f1");
  });
});

describe("getCategoryIcon", () => {
  it("prefers an explicitly stored icon key over the name-derived match", () => {
    // "Grocery" name-matches to ShoppingCart, but an explicit "car" icon key must win
    const icon = getCategoryIcon({ name: "Grocery", icon: "car" });
    expect(icon).toBe(CATEGORY_ICON_MAP["car"]);
    expect(icon).not.toBe(ShoppingCart);
  });

  it("falls back to the name-derived match when icon is null", () => {
    expect(getCategoryIcon({ name: "Grocery", icon: null })).toBe(ShoppingCart);
  });

  it("falls back to the name-derived match when the icon key isn't in the registry", () => {
    expect(getCategoryIcon({ name: "Grocery", icon: "totally-bogus-key" })).toBe(ShoppingCart);
  });
});

describe("getGoalIcon", () => {
  it("matches a keyword case-insensitively", () => {
    expect(getGoalIcon("My Emergency Fund")).not.toBe(Target);
  });

  it("falls back to Target for an unrecognized name", () => {
    expect(getGoalIcon("Project Phoenix")).toBe(Target);
  });
});

describe("resolveGoalIcon", () => {
  it("prefers an explicitly picked icon key over the name-derived match", () => {
    expect(resolveGoalIcon({ name: "Project Phoenix", icon: "Car" })).toBe(Car);
  });

  it("falls back to name-derived matching when icon is null", () => {
    expect(resolveGoalIcon({ name: "Buy a Car", icon: null })).toBe(Car);
  });

  it("falls back to name-derived matching when the icon key is unrecognized", () => {
    expect(resolveGoalIcon({ name: "Buy a Car", icon: "NotARealKey" })).toBe(Car);
  });
});

describe("resolveVaultIcon", () => {
  it("prefers an explicitly picked icon key", () => {
    expect(resolveVaultIcon({ itemType: "LOGIN", icon: "Mail" })).not.toBe(KeyRound);
  });

  it("falls back to KeyRound for a LOGIN item with no icon", () => {
    expect(resolveVaultIcon({ itemType: "LOGIN", icon: null })).toBe(KeyRound);
  });

  it("falls back to FileText for a SECURE_NOTE item with no icon", () => {
    expect(resolveVaultIcon({ itemType: "SECURE_NOTE", icon: null })).toBe(FileText);
  });

  it("falls back by type when the icon key is unrecognized", () => {
    expect(resolveVaultIcon({ itemType: "SECURE_NOTE", icon: "Bogus" })).toBe(FileText);
  });
});
