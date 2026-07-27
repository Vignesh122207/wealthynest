import { describe, it, expect } from "vitest";
import { assetSchema } from "./asset.schema";

describe("assetSchema", () => {
  const base = {
    name: "House",
    assetType: "REAL_ESTATE" as const,
    currentValue: 5000000,
  };

  it("accepts a minimal valid asset", () => {
    expect(assetSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(assetSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects a name over 100 chars", () => {
    expect(assetSchema.safeParse({ ...base, name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects an unrecognized assetType", () => {
    expect(assetSchema.safeParse({ ...base, assetType: "CRYPTO" }).success).toBe(false);
  });

  it("rejects a negative currentValue", () => {
    expect(assetSchema.safeParse({ ...base, currentValue: -1 }).success).toBe(false);
  });

  it("accepts a zero currentValue", () => {
    expect(assetSchema.safeParse({ ...base, currentValue: 0 }).success).toBe(true);
  });

  it("coerces a string currentValue to a number", () => {
    const result = assetSchema.safeParse({ ...base, currentValue: "1234" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currentValue).toBe(1234);
  });

  it("institution/notes/asOfDate are optional", () => {
    expect(assetSchema.safeParse(base).success).toBe(true);
  });
});
