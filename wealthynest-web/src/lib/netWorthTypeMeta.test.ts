import { describe, it, expect } from "vitest";
import { getAssetTypeMeta, getLiabilityTypeMeta, typeLabel, unsecuredDebtRatio } from "./netWorthTypeMeta";

describe("getAssetTypeMeta", () => {
  it("returns the meta entry for a known type", () => {
    expect(getAssetTypeMeta("REAL_ESTATE").hex).toBe("#6366f1");
  });

  it("falls back to the default entry for an unknown type", () => {
    expect(getAssetTypeMeta("UNKNOWN_TYPE").hex).toBe("#64748b");
  });

  it("resolves legacy asset types (e.g. STOCK, GOLD) still present in old records", () => {
    expect(getAssetTypeMeta("STOCK").hex).toBe("#6366f1");
    expect(getAssetTypeMeta("GOLD").hex).toBe("#f59e0b");
  });
});

describe("getLiabilityTypeMeta", () => {
  it("returns the meta entry for a known type", () => {
    expect(getLiabilityTypeMeta("HOME_LOAN").hex).toBe("#ef4444");
  });

  it("falls back to the default entry for an unknown type", () => {
    expect(getLiabilityTypeMeta("UNKNOWN_TYPE").hex).toBe("#64748b");
  });
});

describe("typeLabel", () => {
  const types = [
    { value: "HOME_LOAN", label: "Home Loan" },
    { value: "OTHER", label: "Other" },
  ];

  it("resolves a known value to its label", () => {
    expect(typeLabel(types, "HOME_LOAN")).toBe("Home Loan");
  });

  it("falls back to the raw value when unrecognized", () => {
    expect(typeLabel(types, "SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
  });
});

describe("unsecuredDebtRatio", () => {
  it("excludes home/car/gold loans, which are secured against an already-counted asset", () => {
    const breakdown = [
      { liabilityType: "HOME_LOAN", totalOutstanding: 5_200_000 },
      { liabilityType: "CREDIT_CARD", totalOutstanding: 44_000 },
    ];
    // Only the credit card counts: 44000 / 1000000 = 4.4%
    expect(unsecuredDebtRatio(breakdown, 1_000_000)).toBeCloseTo(4.4, 1);
  });

  it("returns 0 when every liability is secured", () => {
    const breakdown = [
      { liabilityType: "HOME_LOAN", totalOutstanding: 5_200_000 },
      { liabilityType: "CAR_LOAN", totalOutstanding: 420_000 },
    ];
    expect(unsecuredDebtRatio(breakdown, 1_000_000)).toBe(0);
  });

  it("caps at 100 when unsecured debt exceeds total assets", () => {
    const breakdown = [{ liabilityType: "PERSONAL_LOAN", totalOutstanding: 500_000 }];
    expect(unsecuredDebtRatio(breakdown, 100_000)).toBe(100);
  });

  it("returns 0 when there are no assets to divide by", () => {
    const breakdown = [{ liabilityType: "CREDIT_CARD", totalOutstanding: 10_000 }];
    expect(unsecuredDebtRatio(breakdown, 0)).toBe(0);
  });
});
