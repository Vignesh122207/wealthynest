import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormButtons } from "./FormButtons";

describe("FormButtons", () => {
  it("renders the given label when not pending", () => {
    render(<FormButtons onCancel={vi.fn()} isPending={false} label="Save Stock" color="indigo" />);
    expect(screen.getByTestId("investment-form-submit")).toHaveTextContent("Save Stock");
  });

  it("shows 'Saving…' and disables the submit button while pending", () => {
    render(<FormButtons onCancel={vi.fn()} isPending label="Save Stock" color="indigo" />);
    const submit = screen.getByTestId("investment-form-submit");
    expect(submit).toHaveTextContent("Saving…");
    expect(submit).toBeDisabled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(<FormButtons onCancel={onCancel} isPending={false} label="Save" color="indigo" />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("applies the given color's gradient class", () => {
    render(<FormButtons onCancel={vi.fn()} isPending={false} label="Save" color="emerald" />);
    expect(screen.getByTestId("investment-form-submit").className).toContain("from-emerald-600");
  });

  it("falls back to indigo for an unrecognized color", () => {
    render(<FormButtons onCancel={vi.fn()} isPending={false} label="Save" color="not-a-real-color" />);
    expect(screen.getByTestId("investment-form-submit").className).toContain("from-indigo-600");
  });

  it("the submit button has type=submit (so it triggers the enclosing form's onSubmit)", () => {
    render(<FormButtons onCancel={vi.fn()} isPending={false} label="Save" color="indigo" />);
    expect(screen.getByTestId("investment-form-submit")).toHaveAttribute("type", "submit");
  });
});
