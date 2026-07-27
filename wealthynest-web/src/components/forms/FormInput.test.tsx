import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormInput } from "./FormInput";

describe("FormInput", () => {
  it("renders the label and associates it with the input", () => {
    render(<FormInput label="Full Name" />);
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  it("renders no label element when label is omitted", () => {
    render(<FormInput placeholder="Email" />);
    expect(screen.queryByText("Email", { selector: "label" })).not.toBeInTheDocument();
  });

  it("shows the error message and marks the input aria-invalid", () => {
    render(<FormInput label="Email" error="Invalid email address" />);
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows the hint when there is no error", () => {
    render(<FormInput label="Password" hint="At least 8 characters" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("hides the hint when an error is present (error takes precedence)", () => {
    render(<FormInput label="Password" hint="At least 8 characters" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.queryByText("At least 8 characters")).not.toBeInTheDocument();
  });

  it("renders the endAdornment", () => {
    render(<FormInput label="Password" endAdornment={<button>Show</button>} />);
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
  });

  it("accepts user input and calls onChange", async () => {
    const onChange = vi.fn();
    render(<FormInput label="Full Name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Full Name"), "Alice");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards a ref to the underlying input element", () => {
    let ref: HTMLInputElement | null = null;
    render(<FormInput label="Full Name" ref={(el) => { ref = el; }} />);
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });
});
