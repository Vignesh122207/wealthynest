import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormSelect } from "./FormSelect";

const options = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
];

describe("FormSelect", () => {
  it("renders a flat option list", () => {
    render(<FormSelect label="Type" options={options} />);
    expect(screen.getByRole("option", { name: "Expense" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Income" })).toBeInTheDocument();
  });

  it("renders the placeholder as the first (empty-value) option", () => {
    render(<FormSelect label="Type" options={options} placeholder="Select a type" />);
    const placeholderOption = screen.getByRole("option", { name: "Select a type" }) as HTMLOptionElement;
    expect(placeholderOption.value).toBe("");
  });

  it("renders grouped options as optgroups instead of a flat list", () => {
    render(
      <FormSelect label="Category" groups={[
        { label: "Food", options: [{ value: "groceries", label: "Groceries" }] },
        { label: "Bills", options: [{ value: "rent", label: "Rent" }] },
      ]} />
    );
    expect(screen.getByRole("group", { name: "Food" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bills" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Groceries" })).toBeInTheDocument();
  });

  it("shows the error message and marks aria-invalid", () => {
    render(<FormSelect label="Type" options={options} error="Please select a type" />);
    expect(screen.getByText("Please select a type")).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onChange when a different option is selected", async () => {
    const onChange = vi.fn();
    render(<FormSelect label="Type" options={options} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Type"), "INCOME");
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards a ref to the underlying select element", () => {
    let ref: HTMLSelectElement | null = null;
    render(<FormSelect label="Type" options={options} ref={(el) => { ref = el; }} />);
    expect(ref).toBeInstanceOf(HTMLSelectElement);
  });
});
