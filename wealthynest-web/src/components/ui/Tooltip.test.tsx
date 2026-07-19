import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTooltip } from "./Tooltip";

describe("InfoTooltip", () => {
  it("does not render the tooltip content until triggered", () => {
    render(<InfoTooltip content="Helpful hint" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the content on hover", async () => {
    render(<InfoTooltip content="Helpful hint" />);
    await userEvent.hover(screen.getByRole("button", { name: "More info" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Helpful hint");
  });

  it("hides the content when the pointer leaves", async () => {
    render(<InfoTooltip content="Helpful hint" />);
    const trigger = screen.getByRole("button", { name: "More info" });
    await userEvent.hover(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await userEvent.unhover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("toggles open on click (tap support, no hover on touch devices)", () => {
    render(<InfoTooltip content="Helpful hint" />);
    // fireEvent.click dispatches only a click event (no browser focus preamble), isolating the
    // toggle handler itself — userEvent.click's realistic focus-then-click sequence would also
    // fire onFocus, which opens the tooltip a step earlier and masks what click alone does.
    const trigger = screen.getByRole("button", { name: "More info" });
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the content on keyboard focus", () => {
    render(<InfoTooltip content="Helpful hint" />);
    fireEvent.focus(screen.getByRole("button", { name: "More info" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
