import { describe, it, expect } from "vitest";
import { getAssetTypeMeta, getLiabilityTypeMeta, typeLabel } from "./netWorthTypeMeta";

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
