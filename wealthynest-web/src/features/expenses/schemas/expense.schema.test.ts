import { describe, it, expect } from "vitest";
import { expenseSchema } from "./expense.schema";

const validUuid1 = "11111111-1111-1111-1111-111111111111";
const validUuid2 = "22222222-2222-2222-2222-222222222222";

describe("expenseSchema", () => {
  const valid = {
    categoryId: validUuid1,
    accountId: validUuid2,
    amount: 500,
    expenseDate: "2026-06-01",
  };

  it("accepts a fully valid expense", () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-UUID categoryId", () => {
    const result = expenseSchema.safeParse({ ...valid, categoryId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.categoryId).toContain("Select a category");
  });

  it("rejects a non-UUID accountId", () => {
    const result = expenseSchema.safeParse({ ...valid, accountId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.accountId).toContain("Select an account");
  });

  it("rejects a zero amount", () => {
    const result = expenseSchema.safeParse({ ...valid, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = expenseSchema.safeParse({ ...valid, amount: -50 });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric string amount from a native form input", () => {
    const result = expenseSchema.safeParse({ ...valid, amount: "750" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(750);
  });

  it("rejects a missing expenseDate", () => {
    const result = expenseSchema.safeParse({ ...valid, expenseDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.expenseDate).toContain("Date is required");
  });

  it("treats description as optional", () => {
    const { description: _omit, ...rest } = valid as typeof valid & { description?: string };
    expect(expenseSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects a description longer than 255 characters", () => {
    const result = expenseSchema.safeParse({ ...valid, description: "x".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("treats notes as optional", () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true);
    expect(expenseSchema.safeParse({ ...valid, notes: "Paid in two installments" }).success).toBe(true);
  });

  it("treats latitude/longitude as optional", () => {
    expect(expenseSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts valid latitude/longitude", () => {
    const result = expenseSchema.safeParse({ ...valid, latitude: 12.9716, longitude: 77.5946 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.latitude).toBe(12.9716);
      expect(result.data.longitude).toBe(77.5946);
    }
  });

  it("rejects an out-of-range latitude", () => {
    expect(expenseSchema.safeParse({ ...valid, latitude: 91, longitude: 0 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...valid, latitude: -91, longitude: 0 }).success).toBe(false);
  });

  it("rejects an out-of-range longitude", () => {
    expect(expenseSchema.safeParse({ ...valid, latitude: 0, longitude: 181 }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...valid, latitude: 0, longitude: -181 }).success).toBe(false);
  });
});
