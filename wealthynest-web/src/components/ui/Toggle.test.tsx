import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders as an accessible switch reflecting the checked prop", () => {
    render(<Toggle checked onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("reflects an unchecked state", () => {
    render(<Toggle checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the flipped value when clicked", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when clicked while checked", async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("applies the caller-supplied testId", () => {
    render(<Toggle checked onChange={vi.fn()} testId="my-toggle" />);
    expect(screen.getByTestId("my-toggle")).toBeInTheDocument();
  });

  it("uses the copper brand color when on, muted when off", () => {
    const { rerender } = render(<Toggle checked onChange={vi.fn()} />);
    expect(screen.getByRole("switch").className).toContain("bg-primary");

    rerender(<Toggle checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole("switch").className).toContain("bg-muted-foreground/25");
  });

  it("is disabled and does not fire onChange when disabled", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    const el = screen.getByRole("switch");
    expect(el).toBeDisabled();
    await userEvent.click(el);
    expect(onChange).not.toHaveBeenCalled();
  });
});
