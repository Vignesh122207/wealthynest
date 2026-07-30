import { describe, it, expect } from "vitest";
import { darken, lighten, badgeTextColor, TONE_HEX } from "./PremiumIcon";

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgb(css: string): [number, number, number] {
  const m = css.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (!m) throw new Error(`not an rgb() string: ${css}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("lighten/darken", () => {
  it("lighten moves every channel toward 255", () => {
    const [r, g, b] = parseRgb(lighten("#5856d6", 0.3));
    expect(r).toBeGreaterThan(0x58);
    expect(g).toBeGreaterThan(0x56);
    expect(b).toBeGreaterThan(0xd6);
  });

  it("darken moves every channel toward 0", () => {
    const [r, g, b] = parseRgb(darken("#ffd60a", 0.5));
    expect(r).toBeLessThan(0xff);
    expect(g).toBeLessThan(0xd6);
    expect(b).toBeLessThan(0x0a + 1);
  });

  it("amount=0 is a no-op for both", () => {
    expect(parseRgb(lighten("#5856d6", 0))).toEqual([0x58, 0x56, 0xd6]);
    expect(parseRgb(darken("#5856d6", 0))).toEqual([0x58, 0x56, 0xd6]);
  });
});

describe("badgeTextColor", () => {
  // Badges render `color: badgeTextColor(hex, isDark)` as text against a background tinted with
  // the same raw hex at up to ~12.5% alpha (see AllTransactionRow.tsx, LiabilityRow.tsx, etc.) —
  // this must clear WCAG AA's 4.5:1 for every color in the palette, against the tinted background
  // it actually renders on in both themes, not just against a flat white/black reference.
  const darkCard: [number, number, number] = [0x0d, 0x1b, 0x2b];
  const lightCard: [number, number, number] = [0xff, 0xff, 0xff];
  const worstCaseAlpha = 0.125;

  function selfTintedBg(hex: string, card: [number, number, number]): [number, number, number] {
    const [r, g, b] = parseRgb(`rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`);
    return [
      Math.round(r * worstCaseAlpha + card[0] * (1 - worstCaseAlpha)),
      Math.round(g * worstCaseAlpha + card[1] * (1 - worstCaseAlpha)),
      Math.round(b * worstCaseAlpha + card[2] * (1 - worstCaseAlpha)),
    ];
  }

  it.each(Object.entries(TONE_HEX))("%s clears 4.5:1 in dark mode against its own self-tinted background", (_name, hex) => {
    const bg = selfTintedBg(hex, darkCard);
    const text = parseRgb(badgeTextColor(hex, true));
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(TONE_HEX))("%s clears 4.5:1 in light mode against its own self-tinted background", (_name, hex) => {
    const bg = selfTintedBg(hex, lightCard);
    const text = parseRgb(badgeTextColor(hex, false));
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("also clears 4.5:1 for non-TONE_HEX colors used the same way (vault brass, banking gold)", () => {
    for (const hex of ["#d4a72c", "#B8863A"]) {
      const darkBg = selfTintedBg(hex, darkCard);
      expect(contrast(parseRgb(badgeTextColor(hex, true)), darkBg)).toBeGreaterThanOrEqual(4.5);
      const lightBg = selfTintedBg(hex, lightCard);
      expect(contrast(parseRgb(badgeTextColor(hex, false)), lightBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
