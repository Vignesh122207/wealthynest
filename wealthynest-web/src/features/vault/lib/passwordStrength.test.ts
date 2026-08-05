import {describe, expect, it} from "vitest";
import {estimatePasswordStrength, isNumericPin} from "./passwordStrength";

describe("isNumericPin", () => {
  it("is true for 4- and 6-digit numeric secrets (ATM PIN/MPIN)", () => {
    expect(isNumericPin("1234")).toBe(true);
    expect(isNumericPin("998877")).toBe(true);
  });

  it("is false for anything else, including 5/7-digit or non-numeric strings", () => {
    expect(isNumericPin("12345")).toBe(false);
    expect(isNumericPin("1234567")).toBe(false);
    expect(isNumericPin("abcd")).toBe(false);
    expect(isNumericPin("")).toBe(false);
  });
});

describe("estimatePasswordStrength — numeric PIN branch", () => {
  it("flags common, sequential, repeated-digit, and repeating-block PINs as Very weak", () => {
    for (const pin of ["1234", "1111", "0000", "4321", "123456", "654321", "111111", "121212", "123123", "6969"]) {
      expect(estimatePasswordStrength(pin).level).toBe(0);
    }
  });

  it("does not flag a non-guessable 4/6-digit PIN as weak just for being short", () => {
    expect(estimatePasswordStrength("7392").level).toBeGreaterThan(1);
    expect(estimatePasswordStrength("482913").level).toBeGreaterThan(1);
  });
});

describe("estimatePasswordStrength — password branch (unchanged)", () => {
  it("still scores short single-class passwords as weak", () => {
    expect(estimatePasswordStrength("abc").level).toBe(0);
  });

  it("still scores a long mixed-class password as strong", () => {
    expect(estimatePasswordStrength("Tr0ub4dor&3Xyz!").level).toBeGreaterThan(2);
  });

  it("still caps common breach-list base words at Weak even with digits/symbols appended", () => {
    expect(estimatePasswordStrength("Password123!").level).toBeLessThanOrEqual(1);
  });
});
