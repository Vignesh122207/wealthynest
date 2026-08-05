import {describe, expect, it} from "vitest";
import {
  DEFAULT_GENERATOR_OPTIONS, GENERATOR_LENGTH_MAX, GENERATOR_LENGTH_MIN,
  generatePassphrase, generatePassword,
} from "./passwordGenerator";

describe("generatePassword", () => {
  it("returns a string of exactly the requested length", () => {
    for (const length of [GENERATOR_LENGTH_MIN, 16, GENERATOR_LENGTH_MAX]) {
      expect(generatePassword({ ...DEFAULT_GENERATOR_OPTIONS, length })).toHaveLength(length);
    }
  });

  it("only draws from lowercase letters when every optional class is disabled", () => {
    const result = generatePassword({ length: 32, upper: false, digits: false, symbols: false });
    expect(result).toMatch(/^[a-z]+$/);
  });

  it("includes uppercase/digits/symbols only when their option is enabled", () => {
    const result = generatePassword({ length: 64, upper: true, digits: true, symbols: true });
    expect(result).toMatch(/[a-z]/);
    // Not asserting every class appears (a 64-char draw from a large pool could statistically
    // omit one), just that nothing outside the enabled pool leaked in.
    expect(result).toMatch(/^[a-zA-Z0-9!@#$%^&*()\-_=+[\]{}]+$/);
  });

  it("does not repeat the same value across calls (astronomically unlikely by chance)", () => {
    const a = generatePassword(DEFAULT_GENERATOR_OPTIONS);
    const b = generatePassword(DEFAULT_GENERATOR_OPTIONS);
    expect(a).not.toBe(b);
  });
});

describe("generatePassphrase", () => {
  it("joins the requested number of lowercase-letter words with hyphens", () => {
    const result = generatePassphrase(5);
    const words = result.split("-");
    expect(words).toHaveLength(5);
    for (const word of words) expect(word).toMatch(/^[a-z]+$/);
  });

  it("does not repeat the same value across calls (astronomically unlikely by chance)", () => {
    const a = generatePassphrase(6);
    const b = generatePassphrase(6);
    expect(a).not.toBe(b);
  });
});
