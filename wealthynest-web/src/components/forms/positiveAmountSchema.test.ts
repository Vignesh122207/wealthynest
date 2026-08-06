import { describe, it, expect } from "vitest";
import { positiveAmountSchema } from "./positiveAmountSchema";

describe("positiveAmountSchema", () => {
  it("accepts a positive amount with no max supplied", () => {
    expect(positiveAmountSchema().safeParse({ amount: 100 }).success).toBe(true);
  });

  it("rejects zero, negative, and blank amounts", () => {
    const schema = positiveAmountSchema();
    expect(schema.safeParse({ amount: 0 }).success).toBe(false);
    expect(schema.safeParse({ amount: -5 }).success).toBe(false);
    expect(schema.safeParse({ amount: "" }).success).toBe(false);
  });

  it("rejects an amount over the supplied max, with the given message", () => {
    const result = positiveAmountSchema(500, "Cannot exceed ₹500 remaining.").safeParse({ amount: 600 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.amount).toContain("Cannot exceed ₹500 remaining.");
  });

  it("accepts an amount equal to the max", () => {
    expect(positiveAmountSchema(500).safeParse({ amount: 500 }).success).toBe(true);
  });
});
