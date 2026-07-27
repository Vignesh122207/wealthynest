import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryErrorState } from "./QueryErrorState";

describe("QueryErrorState", () => {
  it("renders the default title and description", () => {
    render(<QueryErrorState onRetry={vi.fn()} />);
    expect(screen.getByText("Couldn't load this")).toBeInTheDocument();
    expect(screen.getByText(/Check your connection/)).toBeInTheDocument();
  });

  it("renders a caller-supplied description instead of the default", () => {
    render(<QueryErrorState onRetry={vi.fn()} description="Could not load your investments." />);
    expect(screen.getByText("Could not load your investments.")).toBeInTheDocument();
    expect(screen.queryByText(/Check your connection/)).not.toBeInTheDocument();
  });

  it("calls onRetry when the Retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(<QueryErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
