import { describe, it, expect } from "vitest";
import { categoricalColor, withCategoricalColors, CATEGORICAL_PALETTE } from "./chartColors";

describe("categoricalColor", () => {
  it("returns the light variant of the slot at the given index", () => {
    expect(categoricalColor(0, false)).toBe(CATEGORICAL_PALETTE[0].light);
  });

  it("returns the dark variant when isDark is true", () => {
    expect(categoricalColor(0, true)).toBe(CATEGORICAL_PALETTE[0].dark);
  });

  it("wraps around the palette length for an out-of-range index", () => {
    const paletteLen = CATEGORICAL_PALETTE.length;
    expect(categoricalColor(paletteLen, false)).toBe(categoricalColor(0, false));
    expect(categoricalColor(paletteLen + 2, false)).toBe(categoricalColor(2, false));
  });
});

describe("withCategoricalColors", () => {
  it("assigns a positional color to each slice when within the palette size", () => {
    const slices = [{ name: "A", value: 10 }, { name: "B", value: 5 }];
    const result = withCategoricalColors(slices, false);
    expect(result).toHaveLength(2);
    expect(result[0].color).toBe(categoricalColor(0, false));
    expect(result[1].color).toBe(categoricalColor(1, false));
    expect(result[0].name).toBe("A");
  });

  it("folds slices beyond the palette size into one trailing \"Other\" slice", () => {
    const max = CATEGORICAL_PALETTE.length;
    const slices = Array.from({ length: max + 3 }, (_, i) => ({ name: `S${i}`, value: 1 }));
    const result = withCategoricalColors(slices, false);

    expect(result).toHaveLength(max);
    expect(result[max - 1].name).toBe("Other");
    // 4 slices folded in (indices max-1..max+2 of the max+3 total), each value 1
    expect(result[max - 1].value).toBe(4);
  });

  it("does not create an Other slice when slice count exactly equals the palette size", () => {
    const max = CATEGORICAL_PALETTE.length;
    const slices = Array.from({ length: max }, (_, i) => ({ name: `S${i}`, value: 1 }));
    const result = withCategoricalColors(slices, false);
    expect(result).toHaveLength(max);
    expect(result.some((s) => s.name === "Other")).toBe(false);
  });
});
