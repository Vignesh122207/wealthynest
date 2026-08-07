import {describe, it, expect} from "vitest";
import {pad, monthLabel, resolveEffectiveAccountIds} from "./filterHelpers";

describe("pad", () => {
  it("pads single digits to two characters", () => {
    expect(pad(3)).toBe("03");
  });

  it("leaves two-digit numbers unchanged", () => {
    expect(pad(12)).toBe("12");
  });
});

describe("monthLabel", () => {
  it("formats a year/month as a long month name and year", () => {
    expect(monthLabel(2026, 7)).toBe("July 2026");
  });
});

describe("resolveEffectiveAccountIds", () => {
  it("returns no filter when neither a channel nor an explicit selection is active", () => {
    expect(resolveEffectiveAccountIds("", [], [])).toEqual([]);
  });

  it("uses the explicit selection when only accounts are picked (no channel)", () => {
    expect(resolveEffectiveAccountIds("", ["a1", "a2"], [])).toEqual(["a1", "a2"]);
  });

  it("uses the channel-derived list when only a channel is picked (no explicit selection)", () => {
    expect(resolveEffectiveAccountIds("CREDIT", [], ["c1", "c2"])).toEqual(["c1", "c2"]);
  });

  it("a channel matching zero accounts still returns empty, not 'no filter'", () => {
    expect(resolveEffectiveAccountIds("CREDIT", [], [])).toEqual([]);
  });

  it("ANDs an explicit selection with an active channel instead of one overriding the other", () => {
    // a1 is a credit card (in the channel list), a2 is not — only a1 should survive.
    expect(resolveEffectiveAccountIds("CREDIT", ["a1", "a2"], ["a1", "a3"])).toEqual(["a1"]);
  });

  it("returns empty when the explicit selection and the channel don't overlap at all", () => {
    expect(resolveEffectiveAccountIds("CREDIT", ["a2"], ["a1", "a3"])).toEqual([]);
  });
});
