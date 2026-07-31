import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BigAmountInput } from "./BigAmountInput";

describe("BigAmountInput", () => {
  // Regression coverage for a real bug: globals.css floors every <input>'s font-size to 16px
  // !important below the 768px breakpoint (an iOS Safari zoom-on-focus fix for this app's normal
  // text-sm/text-xs inputs) — but BigAmountInput's own sizes (fontClassFor: text-lg..text-4xl,
  // i.e. 18px-36px) are already above that floor by design, so the blanket rule only ever
  // shrunk it back down to a flat 16px on narrow viewports, including the native app (always
  // narrow). Confirmed live: "big 0" on a wide browser window, a tiny "0" in the app. The fix
  // opts this input out via the `big-amount-input` class globals.css now excludes.
  it("carries the big-amount-input class that opts it out of the mobile 16px input font-size floor", () => {
    render(<BigAmountInput colorClass="text-foreground" inputProps={{ name: "amount" }} testId="amount-input" />);
    expect(screen.getByTestId("amount-input")).toHaveClass("big-amount-input");
  });

  it("renders at the largest size class for an empty/short value", () => {
    render(<BigAmountInput colorClass="text-foreground" inputProps={{ name: "amount" }} testId="amount-input" />);
    expect(screen.getByTestId("amount-input")).toHaveClass("text-4xl");
  });

  it("shrinks the font size class as the typed value grows longer", () => {
    render(<BigAmountInput colorClass="text-foreground" inputProps={{ name: "amount", defaultValue: "12345678901" }} testId="amount-input" />);
    expect(screen.getByTestId("amount-input")).toHaveClass("text-lg");
  });
});
