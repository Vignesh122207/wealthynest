import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, StatCardSkeleton, TableRowSkeleton } from "./LoadingSkeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder div with a merged className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("h-4 w-20");
  });
});

describe("StatCardSkeleton", () => {
  it("renders three placeholder rows", () => {
    const { container } = render(<StatCardSkeleton />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
});

describe("TableRowSkeleton", () => {
  it("renders 5 rows by default", () => {
    const { container } = render(<TableRowSkeleton />);
    expect(container.children).toHaveLength(5);
  });

  it("renders the given number of rows", () => {
    const { container } = render(<TableRowSkeleton rows={2} />);
    expect(container.children).toHaveLength(2);
  });

  it("renders zero rows when rows=0", () => {
    const { container } = render(<TableRowSkeleton rows={0} />);
    expect(container.children).toHaveLength(0);
  });
});
