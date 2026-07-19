import { describe, it, expect } from "vitest";
import { debtSchema } from "./debt.schema";

describe("debtSchema", () => {
  const base = {
    contactName: "Alice",
    amount: 500,
    debtDate: "2026-01-01",
  };

  it("accepts a minimal valid debt", () => {
    expect(debtSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a blank contactName", () => {
    expect(debtSchema.safeParse({ ...base, contactName: "" }).success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    expect(debtSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(debtSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it("rejects a blank debtDate", () => {
    expect(debtSchema.safeParse({ ...base, debtDate: "" }).success).toBe(false);
  });

  it("accepts an empty-string contactPhone/description/dueDate (optional-or-literal-empty)", () => {
    const result = debtSchema.safeParse({ ...base, contactPhone: "", description: "", dueDate: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a dueDate before the debtDate", () => {
    const result = debtSchema.safeParse({ ...base, debtDate: "2026-02-01", dueDate: "2026-01-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.dueDate).toContain("Due date can't be before the debt date");
    }
  });

  it("accepts a dueDate on or after the debtDate", () => {
    expect(debtSchema.safeParse({ ...base, dueDate: "2026-01-01" }).success).toBe(true);
    expect(debtSchema.safeParse({ ...base, dueDate: "2026-02-01" }).success).toBe(true);
  });
});
