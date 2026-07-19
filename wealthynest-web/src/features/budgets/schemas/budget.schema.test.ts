import { describe, it, expect } from "vitest";
import { budgetSchema, editBudgetSchema } from "./budget.schema";

const validUuid = "11111111-1111-1111-1111-111111111111";

describe("budgetSchema", () => {
  it("accepts a valid budget and defaults budgetType to MONTHLY when omitted", () => {
    const result = budgetSchema.safeParse({ categoryId: validUuid, amount: 1000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budgetType).toBe("MONTHLY");
  });

  it("accepts an explicit YEARLY budgetType", () => {
    const result = budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, budgetType: "YEARLY" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.budgetType).toBe("YEARLY");
  });

  it("rejects an unrecognized budgetType", () => {
    const result = budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, budgetType: "WEEKLY" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID categoryId", () => {
    const result = budgetSchema.safeParse({ categoryId: "nope", amount: 1000 });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 0 }).success).toBe(false);
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: -100 }).success).toBe(false);
  });

  it("treats alertThreshold as optional", () => {
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 1000 }).success).toBe(true);
  });

  it("rejects an alertThreshold below 1 or above 100", () => {
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, alertThreshold: 0 }).success).toBe(false);
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, alertThreshold: 101 }).success).toBe(false);
  });

  it("accepts a boundary alertThreshold of exactly 1 and 100", () => {
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, alertThreshold: 1 }).success).toBe(true);
    expect(budgetSchema.safeParse({ categoryId: validUuid, amount: 1000, alertThreshold: 100 }).success).toBe(true);
  });

  it("coerces a numeric string amount/threshold from native form inputs", () => {
    const result = budgetSchema.safeParse({ categoryId: validUuid, amount: "1000", alertThreshold: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(1000);
      expect(result.data.alertThreshold).toBe(50);
    }
  });
});

describe("editBudgetSchema", () => {
  it("accepts an amount with no categoryId (not part of this shape)", () => {
    expect(editBudgetSchema.safeParse({ amount: 500 }).success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(editBudgetSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it("rejects an out-of-range alertThreshold", () => {
    expect(editBudgetSchema.safeParse({ amount: 500, alertThreshold: 150 }).success).toBe(false);
  });
});
