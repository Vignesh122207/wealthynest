import { describe, it, expect } from "vitest";
import { getRealStockLogoFile, getStockMonogram } from "./stockLogos";

describe("getRealStockLogoFile", () => {
  it("resolves a known symbol case-insensitively and trimmed", () => {
    expect(getRealStockLogoFile("  zomato  ")).toBe("/stock-logos/ZOMATO.svg");
  });

  it("returns undefined for an unmatched symbol", () => {
    expect(getRealStockLogoFile("NOTASYMBOL")).toBeUndefined();
  });

  it("returns undefined when symbol is missing", () => {
    expect(getRealStockLogoFile(undefined)).toBeUndefined();
  });
});

describe("getStockMonogram", () => {
  it("resolves a known symbol case-insensitively and trimmed", () => {
    expect(getStockMonogram("  reliance  ")).toEqual({ initials: "RIL", hex: "#002E6D" });
  });

  it("returns undefined for an unmatched symbol", () => {
    expect(getStockMonogram("NOTASYMBOL")).toBeUndefined();
  });

  it("returns undefined when symbol is missing", () => {
    expect(getStockMonogram(undefined)).toBeUndefined();
  });
});
