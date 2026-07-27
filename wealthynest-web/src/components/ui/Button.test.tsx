import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading forces disabled even when disabled isn't explicitly passed", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("loading renders a spinner before the children", () => {
    const { container } = render(<Button loading>Save</Button>);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("does not render a spinner when not loading", () => {
    const { container } = render(<Button>Save</Button>);
    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
  });

  it("applies the variant's classes (defaulting to primary)", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").className).toContain("bg-[#c2703d]");
  });

  it("a caller-supplied className can override the variant's default background (twMerge)", () => {
    render(<Button className="bg-emerald-600">Save</Button>);
    const className = screen.getByRole("button").className;
    expect(className).toContain("bg-emerald-600");
    expect(className).not.toContain("bg-[#c2703d]");
  });

  it("forwards a ref to the underlying button element", () => {
    let ref: HTMLButtonElement | null = null;
    render(<Button ref={(el) => { ref = el; }}>Save</Button>);
    expect(ref).toBeInstanceOf(HTMLButtonElement);
  });
});
