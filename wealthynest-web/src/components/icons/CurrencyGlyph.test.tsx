import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyGlyph } from "./CurrencyGlyph";

describe("CurrencyGlyph", () => {
  it("renders the real dirham SVG for AED, not the text code", () => {
    render(<CurrencyGlyph code="AED" />);
    expect(screen.getByRole("img", { name: "AED" })).toBeInTheDocument();
    expect(screen.queryByText("AED")).not.toBeInTheDocument();
  });

  it("renders the plain-text symbol for every other currency", () => {
    render(<CurrencyGlyph code="INR" />);
    expect(screen.getByText("₹")).toBeInTheDocument();
  });

  it("falls back to the stored currency when no code is passed", () => {
    render(<CurrencyGlyph />);
    expect(screen.getByText("₹")).toBeInTheDocument(); // default store currency is INR
  });
});
