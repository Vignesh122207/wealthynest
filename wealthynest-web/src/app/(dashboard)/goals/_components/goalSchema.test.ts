import { describe, it, expect } from "vitest";
import { goalSchema } from "./goalSchema";

describe("goalSchema", () => {
  it("accepts a valid unlinked goal", () => {
    const result = goalSchema(false).safeParse({ name: "Emergency Fund", targetAmount: 1000, savedAmount: 200 });
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(goalSchema(false).safeParse({ name: "", targetAmount: 1000 }).success).toBe(false);
  });

  it("rejects a zero or negative targetAmount", () => {
    expect(goalSchema(false).safeParse({ name: "Goal", targetAmount: 0 }).success).toBe(false);
    expect(goalSchema(false).safeParse({ name: "Goal", targetAmount: -100 }).success).toBe(false);
  });

  it("rejects a negative savedAmount", () => {
    const result = goalSchema(false).safeParse({ name: "Goal", targetAmount: 1000, savedAmount: -1 });
    expect(result.success).toBe(false);
  });

  it("defaults savedAmount to 0 when omitted", () => {
    const result = goalSchema(false).safeParse({ name: "Goal", targetAmount: 1000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.savedAmount).toBe(0);
  });

  describe("isLinked = false (manually-tracked goal)", () => {
    it("rejects savedAmount greater than targetAmount", () => {
      const result = goalSchema(false).safeParse({ name: "Goal", targetAmount: 1000, savedAmount: 1500 });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].path).toEqual(["savedAmount"]);
    });

    it("allows savedAmount exactly equal to targetAmount (boundary)", () => {
      const result = goalSchema(false).safeParse({ name: "Goal", targetAmount: 1000, savedAmount: 1000 });
      expect(result.success).toBe(true);
    });
  });

  describe("isLinked = true (account-linked goal)", () => {
    // Regression: a linked goal's savedAmount is a snapshot of the linked account's live
    // balance, not a user-typed figure — that balance can perfectly validly already exceed
    // the target (the goal simply starts complete). The unconditional cap used to reject this
    // client-side before the request ever reached the (also-fixed) backend.
    it("allows savedAmount greater than targetAmount", () => {
      const result = goalSchema(true).safeParse({ name: "Goal", targetAmount: 1000, savedAmount: 1500 });
      expect(result.success).toBe(true);
    });

    it("still rejects a negative savedAmount", () => {
      const result = goalSchema(true).safeParse({ name: "Goal", targetAmount: 1000, savedAmount: -1 });
      expect(result.success).toBe(false);
    });

    it("still rejects a blank name and non-positive targetAmount", () => {
      expect(goalSchema(true).safeParse({ name: "", targetAmount: 1000 }).success).toBe(false);
      expect(goalSchema(true).safeParse({ name: "Goal", targetAmount: 0 }).success).toBe(false);
    });
  });
});
