import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies the base card shell classes", () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("bg-card");
  });

  it("merges a caller-supplied className alongside the base classes", () => {
    render(<Card data-testid="card" className="p-6">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("p-6");
  });

  it("forwards a ref to the underlying div element", () => {
    let ref: HTMLDivElement | null = null;
    render(<Card ref={(el) => { ref = el; }}>Content</Card>);
    expect(ref).toBeInstanceOf(HTMLDivElement);
  });
});
