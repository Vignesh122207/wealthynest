import { describe, it, expect } from "vitest";
import { getRealLogoFile, getLogoFit, getBankMonogram } from "./bankLogos";

describe("getRealLogoFile", () => {
  it("resolves a known bank name case-insensitively and trimmed", () => {
    expect(getRealLogoFile("  HDFC Bank  ")).toBe("/bank-logos/hdfc.svg");
  });

  it("returns undefined for an unmatched name", () => {
    expect(getRealLogoFile("Some Random Bank")).toBeUndefined();
  });

  it("returns undefined when name is missing", () => {
    expect(getRealLogoFile(undefined)).toBeUndefined();
  });
});

describe("getLogoFit", () => {
  it("returns \"contain\" for the documented overrides", () => {
    expect(getLogoFit("Zerodha")).toBe("contain");
    expect(getLogoFit("Canara Bank")).toBe("contain");
  });

  it("defaults to \"cover\" for everything else", () => {
    expect(getLogoFit("HDFC Bank")).toBe("cover");
  });

  it("defaults to \"cover\" when name is missing", () => {
    expect(getLogoFit(undefined)).toBe("cover");
  });
});

describe("getBankMonogram", () => {
  it("resolves a known bank to its initials/hex", () => {
    expect(getBankMonogram("State Bank of India")).toEqual({ initials: "SBI", hex: "#2A5DB0" });
  });

  it("resolves a known broker (separate registry, merged into the same lookup)", () => {
    expect(getBankMonogram("Zerodha")).toEqual({ initials: "Z", hex: "#387ED1" });
  });

  it("returns undefined for an unmatched name", () => {
    expect(getBankMonogram("Some Random Bank")).toBeUndefined();
  });

  it("returns undefined when name is missing", () => {
    expect(getBankMonogram(undefined)).toBeUndefined();
  });
});
