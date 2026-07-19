import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormCurrencyInput } from "./FormCurrencyInput";
import { usePrefsStore } from "@/store/preferences.store";

beforeEach(() => {
  usePrefsStore.setState({ currency: "INR" });
});

describe("FormCurrencyInput", () => {
  it("renders the store's currency symbol by default", () => {
    render(<FormCurrencyInput label="Amount" />);
    expect(screen.getByText("₹")).toBeInTheDocument();
  });

  it("renders a caller-supplied currency symbol override", () => {
    render(<FormCurrencyInput label="Amount" currency="$" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("resolves the symbol for a non-default store currency", () => {
    usePrefsStore.setState({ currency: "USD" });
    render(<FormCurrencyInput label="Amount" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("strips non-numeric characters as the user types", async () => {
    render(<FormCurrencyInput label="Amount" />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    await userEvent.type(input, "12a3b.c5");
    expect(input.value).toBe("123.5");
  });

  it("collapses a second decimal point instead of allowing multiple", async () => {
    render(<FormCurrencyInput label="Amount" />);
    const input = screen.getByLabelText("Amount") as HTMLInputElement;
    await userEvent.type(input, "12.3.5");
    expect(input.value).toBe("12.35");
  });

  it("calls the caller's onChange with the cleaned value", async () => {
    const onChange = vi.fn();
    render(<FormCurrencyInput label="Amount" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Amount"), "5a0");
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.target.value).toBe("50");
  });

  it("uses type=text with inputMode=decimal (not type=number, per WebKit auto-select workaround)", () => {
    render(<FormCurrencyInput label="Amount" />);
    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputMode", "decimal");
  });

  it("shows the error message and marks aria-invalid", () => {
    render(<FormCurrencyInput label="Amount" error="Amount must be positive" />);
    expect(screen.getByText("Amount must be positive")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveAttribute("aria-invalid", "true");
  });
});
