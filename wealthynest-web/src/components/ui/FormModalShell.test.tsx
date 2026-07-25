import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormModalShell } from "./FormModalShell";

describe("FormModalShell", () => {
  it("renders its children inside the body", () => {
    render(<FormModalShell accent="from-fuchsia-500 to-pink-600">Form fields</FormModalShell>);
    expect(screen.getByText("Form fields")).toBeInTheDocument();
  });

  it("applies the accent gradient classes to the top strip", () => {
    const { container } = render(
      <FormModalShell accent="from-fuchsia-500 to-pink-600">Form fields</FormModalShell>
    );
    const strip = container.querySelector(".h-1\\.5");
    expect(strip?.className).toContain("from-fuchsia-500");
    expect(strip?.className).toContain("to-pink-600");
  });

  it("merges a caller-supplied className onto the outer shell", () => {
    const { container } = render(
      <FormModalShell accent="from-fuchsia-500 to-pink-600" className="max-w-md">Form fields</FormModalShell>
    );
    expect(container.firstElementChild?.className).toContain("max-w-md");
  });

  it("omits the accent strip entirely when accent is \"none\"", () => {
    // A caller with its own full-bleed header (e.g. Vault's VaultModalHeader) needs no strip at
    // all — even a transparent gradient still occupies the strip's height and leaks the shell's
    // own background color above the header.
    const { container } = render(<FormModalShell accent="none">Form fields</FormModalShell>);
    expect(container.querySelector(".h-1\\.5")).not.toBeInTheDocument();
  });
});
