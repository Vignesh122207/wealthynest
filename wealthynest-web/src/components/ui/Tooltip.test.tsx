import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTooltip, Tooltip } from "./Tooltip";

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

  it("opens upward by default", () => {
    render(<InfoTooltip content="Helpful hint" />);
    fireEvent.focus(screen.getByRole("button", { name: "More info" }));
    expect(screen.getByRole("tooltip")).toHaveClass("bottom-full");
  });

  it("opens downward when side=\"bottom\" — for a trigger with nothing above it to open into (e.g. right under a sticky header)", () => {
    render(<InfoTooltip content="Helpful hint" side="bottom" />);
    fireEvent.focus(screen.getByRole("button", { name: "More info" }));
    expect(screen.getByRole("tooltip")).toHaveClass("top-full");
  });
});

describe("Tooltip", () => {
  it("does not render the tooltip content until triggered", () => {
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the content on hover after the show delay", async () => {
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    await userEvent.hover(screen.getByRole("button", { name: "icon" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent("Accounts"));
  });

  it("cancels the pending show if the pointer leaves before the delay elapses", async () => {
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    const trigger = screen.getByRole("button", { name: "icon" });
    await userEvent.hover(trigger);
    await userEvent.unhover(trigger);
    await new Promise((r) => setTimeout(r, 350));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the content instantly on keyboard focus, with no delay", () => {
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    fireEvent.focus(screen.getByRole("button", { name: "icon" }));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("hides on blur", () => {
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    const trigger = screen.getByRole("button", { name: "icon" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on click, so selecting a collapsed nav item doesn't leave it stuck open", () => {
    // Regression: a Next.js <Link> keeps focus after a client-side navigation, so relying on
    // blur alone left the tooltip pinned open on the newly-active icon.
    render(<Tooltip content="Accounts"><button>icon</button></Tooltip>);
    const trigger = screen.getByRole("button", { name: "icon" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
