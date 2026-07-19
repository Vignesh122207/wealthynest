import { describe, it, expect } from "vitest";
import { incomeSchema } from "./income.schema";

describe("incomeSchema", () => {
  const base = {
    source: "SALARY" as const,
    amount: 50000,
    incomeDate: "2026-07-01",
    periodMonth: 7,
    periodYear: 2026,
  };

  it("accepts a minimal valid income, defaulting paymentMode to BANK_ACCOUNT", () => {
    const result = incomeSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.paymentMode).toBe("BANK_ACCOUNT");
  });

  it("rejects an unrecognized source", () => {
    expect(incomeSchema.safeParse({ ...base, source: "LOTTERY" }).success).toBe(false);
  });

  it("rejects an unrecognized paymentMode", () => {
    expect(incomeSchema.safeParse({ ...base, paymentMode: "CRYPTO" }).success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(incomeSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
  });

  it("rejects a blank incomeDate", () => {
    expect(incomeSchema.safeParse({ ...base, incomeDate: "" }).success).toBe(false);
  });

  it("rejects a periodMonth outside 1-12", () => {
    expect(incomeSchema.safeParse({ ...base, periodMonth: 0 }).success).toBe(false);
    expect(incomeSchema.safeParse({ ...base, periodMonth: 13 }).success).toBe(false);
  });

  it("rejects a periodYear before 2020", () => {
    expect(incomeSchema.safeParse({ ...base, periodYear: 2019 }).success).toBe(false);
  });

  it("coerces string amount/periodMonth/periodYear to numbers", () => {
    const result = incomeSchema.safeParse({ ...base, amount: "50000", periodMonth: "7", periodYear: "2026" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(50000);
      expect(result.data.periodMonth).toBe(7);
    }
  });
});
