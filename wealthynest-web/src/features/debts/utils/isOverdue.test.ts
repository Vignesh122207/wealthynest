import { describe, it, expect } from "vitest";
import { isDebtOverdue } from "./isOverdue";

const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const tomorrow  = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("isDebtOverdue", () => {
  it("is true for a past due date on a non-settled debt", () => {
    expect(isDebtOverdue({ dueDate: yesterday, status: "ACTIVE" })).toBe(true);
    expect(isDebtOverdue({ dueDate: yesterday, status: "PARTIAL" })).toBe(true);
  });

  it("is false once the debt is SETTLED, even with a past due date", () => {
    expect(isDebtOverdue({ dueDate: yesterday, status: "SETTLED" })).toBe(false);
  });

  it("is false for a future due date", () => {
    expect(isDebtOverdue({ dueDate: tomorrow, status: "ACTIVE" })).toBe(false);
  });

  it("is false with no due date at all", () => {
    expect(isDebtOverdue({ dueDate: undefined, status: "ACTIVE" })).toBe(false);
  });
});
