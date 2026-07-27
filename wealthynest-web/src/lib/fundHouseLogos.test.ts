import { describe, it, expect } from "vitest";
import { getRealFundLogoFile, getFundHouseMonogram } from "./fundHouseLogos";

describe("getRealFundLogoFile", () => {
  it("returns undefined for everything (no real logo files curated yet)", () => {
    expect(getRealFundLogoFile("HDFC Bluechip Fund")).toBeUndefined();
  });

  it("returns undefined when companyName is missing", () => {
    expect(getRealFundLogoFile(undefined)).toBeUndefined();
  });
});

describe("getFundHouseMonogram", () => {
  it("matches a scheme name by AMC-name prefix", () => {
    expect(getFundHouseMonogram("ICICI Prudential Bluechip Fund - Growth"))
      .toEqual({ initials: "ICICI", hex: "#F58220" });
  });

  it("prefers the longest matching prefix over a shorter one that also matches", () => {
    // "Kotak Mahindra ..." starts with both "kotak mahindra" and the shorter "kotak" prefix —
    // the longer, more specific entry must win.
    expect(getFundHouseMonogram("Kotak Mahindra Equity Fund - Growth"))
      .toEqual({ initials: "KTK", hex: "#ED1C24" });
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(getFundHouseMonogram("  hdfc top 100 fund  "))
      .toEqual({ initials: "HDFC", hex: "#E31E24" });
  });

  it("returns undefined for a scheme name matching no known AMC prefix", () => {
    expect(getFundHouseMonogram("Some Unknown Fund House Scheme")).toBeUndefined();
  });

  it("returns undefined when companyName is missing", () => {
    expect(getFundHouseMonogram(undefined)).toBeUndefined();
  });
});
