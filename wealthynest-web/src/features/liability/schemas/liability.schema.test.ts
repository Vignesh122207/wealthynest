import { describe, it, expect } from "vitest";
import { liabilitySchema } from "./liability.schema";

describe("liabilitySchema", () => {
  const base = {
    name: "Home Loan",
    liabilityType: "HOME_LOAN" as const,
    principalAmount: 500000,
    outstandingAmount: 400000,
  };

  it("accepts a minimal valid liability", () => {
    expect(liabilitySchema.safeParse(base).success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(liabilitySchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects an unrecognized liabilityType", () => {
    expect(liabilitySchema.safeParse({ ...base, liabilityType: "CRYPTO_LOAN" }).success).toBe(false);
  });

  it("rejects a negative principalAmount or outstandingAmount", () => {
    expect(liabilitySchema.safeParse({ ...base, principalAmount: -1 }).success).toBe(false);
    expect(liabilitySchema.safeParse({ ...base, outstandingAmount: -1 }).success).toBe(false);
  });

  it("rejects a blank/zero principalAmount instead of silently coercing to 0", () => {
    const blank = liabilitySchema.safeParse({ ...base, principalAmount: "" });
    expect(blank.success).toBe(false);
    if (!blank.success) expect(blank.error.flatten().fieldErrors.principalAmount).toContain("Original loan amount is required");
    expect(liabilitySchema.safeParse({ ...base, principalAmount: 0 }).success).toBe(false);
  });

  it("treats a blank interestRate/emiAmount as unset, not 0", () => {
    const result = liabilitySchema.safeParse({ ...base, interestRate: "", emiAmount: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interestRate).toBeUndefined();
      expect(result.data.emiAmount).toBeUndefined();
    }
  });

  it("rejects outstandingAmount exceeding principalAmount", () => {
    const result = liabilitySchema.safeParse({ ...base, outstandingAmount: 600000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.outstandingAmount).toContain("Cannot exceed original loan amount");
    }
  });

  it("accepts outstandingAmount equal to principalAmount", () => {
    expect(liabilitySchema.safeParse({ ...base, outstandingAmount: 500000 }).success).toBe(true);
  });

  it("rejects an interestRate outside 0-100", () => {
    expect(liabilitySchema.safeParse({ ...base, interestRate: -1 }).success).toBe(false);
    expect(liabilitySchema.safeParse({ ...base, interestRate: 101 }).success).toBe(false);
  });

  it("lenderName/emiAmount/startDate/endDate/notes are optional", () => {
    expect(liabilitySchema.safeParse(base).success).toBe(true);
  });
});
