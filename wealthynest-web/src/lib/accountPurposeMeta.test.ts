import { describe, it, expect } from "vitest";
import { resolvePurposeLabel } from "./accountPurposeMeta";

describe("resolvePurposeLabel", () => {
  it("returns null when there's no purpose", () => {
    expect(resolvePurposeLabel(null)).toBeNull();
    expect(resolvePurposeLabel(undefined)).toBeNull();
  });

  it("resolves a known purpose to its display label", () => {
    expect(resolvePurposeLabel("EMERGENCY_FUND")).toBe("Emergency Fund");
    expect(resolvePurposeLabel("HOUSE_PURCHASE")).toBe("House Purchase");
  });

  it("resolves CUSTOM to its free-text label", () => {
    expect(resolvePurposeLabel("CUSTOM", "Sabbatical")).toBe("Sabbatical");
  });

  it("falls back to 'Custom' when CUSTOM has a blank/missing label", () => {
    expect(resolvePurposeLabel("CUSTOM", null)).toBe("Custom");
    expect(resolvePurposeLabel("CUSTOM", "  ")).toBe("Custom");
  });

  it("falls back to the raw value for an unrecognized purpose", () => {
    expect(resolvePurposeLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
