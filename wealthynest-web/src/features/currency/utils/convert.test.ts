import {describe, it, expect} from "vitest";
import {convertAmount} from "./convert";

describe("convertAmount", () => {
  it("returns the amount unchanged when target equals base", () => {
    expect(convertAmount(1000, "INR", "INR", { USD: 0.012 })).toBe(1000);
  });

  it("multiplies by the target currency's rate", () => {
    expect(convertAmount(1000, "USD", "INR", { USD: 0.012, EUR: 0.011 })).toBeCloseTo(12, 5);
  });

  it("picks the correct rate among multiple target currencies", () => {
    expect(convertAmount(1000, "EUR", "INR", { USD: 0.012, EUR: 0.011 })).toBeCloseTo(11, 5);
  });

  it("returns the amount unchanged when rates are undefined (not yet loaded)", () => {
    expect(convertAmount(1000, "USD", "INR", undefined)).toBe(1000);
  });

  it("returns the amount unchanged when the target currency has no rate", () => {
    expect(convertAmount(1000, "GBP", "INR", { USD: 0.012 })).toBe(1000);
  });

  it("handles zero and negative amounts correctly", () => {
    expect(convertAmount(0, "USD", "INR", { USD: 0.012 })).toBe(0);
    expect(convertAmount(-500, "USD", "INR", { USD: 0.012 })).toBeCloseTo(-6, 5);
  });
});
